"""
VoiceAgent — Vapi WebSocket Bridge
Connects to Vapi's listenUrl after a call is created, normalizes all
incoming events, and pushes them into ws_manager so the SSE stream
endpoint can forward them to the frontend.

Usage:
    asyncio.create_task(start_vapi_bridge(call_id, listen_url))
"""

import asyncio
import json
import logging
from typing import Optional

import websockets
from websockets.exceptions import ConnectionClosed, WebSocketException

from app.services.ws_manager import ws_manager

logger = logging.getLogger(__name__)

# Active bridge tasks keyed by call_id — prevents duplicate bridges
_active_bridges: dict[str, asyncio.Task] = {}


def normalize_vapi_event(raw: dict) -> Optional[dict]:
    """
    Convert any Vapi WebSocket message into a consistent shape
    that the frontend SSE consumer understands.

    Vapi event types we handle:
      - transcript          → live partial/final transcript
      - status-update       → call status changed
      - call-ended          → call finished (terminal)
      - hang                → hang-up triggered
      - speech-update       → assistant/user speech start/stop
      - function-call       → tool call (pass through)
      - end-of-call-report  → final summary + artifact
    """
    msg_type = raw.get("type", "")

    # ── Transcript ──────────────────────────────────────────────────────────
    if msg_type == "transcript":
        role = raw.get("role", "unknown")           # "user" | "assistant"
        transcript_type = raw.get("transcriptType", "final")  # "partial" | "final"
        return {
            "type": "transcript",
            "speaker": "user" if role == "user" else "agent",
            "text": raw.get("transcript", ""),
            "is_partial": transcript_type == "partial",
            "timestamp": raw.get("timestamp"),
        }

    # ── Status update ────────────────────────────────────────────────────────
    if msg_type == "status-update":
        return {
            "type": "status-update",
            "status": raw.get("status", "unknown"),
            "timestamp": raw.get("timestamp"),
        }

    # ── Call ended (terminal) ────────────────────────────────────────────────
    if msg_type in ("call-ended", "hang"):
        return {
            "type": "call-ended",
            "reason": raw.get("reason") or raw.get("hangReason", "unknown"),
            "timestamp": raw.get("timestamp"),
        }

    # ── End-of-call report ───────────────────────────────────────────────────
    if msg_type == "end-of-call-report":
        return {
            "type": "call-ended",
            "reason": "completed",
            "summary": raw.get("summary"),
            "recording_url": raw.get("artifact", {}).get("recordingUrl"),
            "duration_secs": raw.get("durationSeconds"),
            "timestamp": raw.get("timestamp"),
        }

    # ── Speech update (talking indicators) ──────────────────────────────────
    if msg_type == "speech-update":
        return {
            "type": "speech-update",
            "role": raw.get("role", "unknown"),
            "status": raw.get("status", "unknown"),   # "started" | "stopped"
            "timestamp": raw.get("timestamp"),
        }

    # ── Pass through anything else ────────────────────────────────────────
    return {"type": msg_type, "raw": raw}


async def _bridge_task(call_id: str, listen_url: str) -> None:
    """
    Core bridge loop. Connects to Vapi's listenUrl WS, reads events,
    normalizes them, and pushes to ws_manager.
    Reconnects up to 3 times on unexpected disconnection.
    """
    max_retries = 3
    attempt = 0

    while attempt <= max_retries:
        try:
            logger.info(f"[Bridge] Connecting to Vapi WS for call {call_id} (attempt {attempt + 1})")
            async with websockets.connect(
                listen_url,
                ping_interval=20,
                ping_timeout=10,
                close_timeout=5,
            ) as ws:
                logger.info(f"[Bridge] Connected for call {call_id}")
                attempt = 0  # reset on successful connect

                async for raw_message in ws:
                    try:
                        # Binary frames are PCM audio chunks from Vapi — not JSON events.
                        # Skip them silently; they carry no transcript/status data we need.
                        if isinstance(raw_message, bytes):
                            logger.debug(f"[Bridge] Binary audio frame for call {call_id} ({len(raw_message)} bytes) — skipping")
                            continue

                        data = json.loads(raw_message)
                        normalized = normalize_vapi_event(data)

                        if normalized:
                            await ws_manager.broadcast(call_id, normalized)

                            # Stop bridge on terminal events
                            if normalized.get("type") == "call-ended":
                                logger.info(f"[Bridge] Call {call_id} ended — closing bridge")
                                return

                    except json.JSONDecodeError:
                        logger.warning(f"[Bridge] Unexpected non-JSON text frame for call {call_id}: {raw_message[:120]!r}")
                    except Exception as e:
                        logger.warning(f"[Bridge] Error processing frame for {call_id}: {e}")

        except ConnectionClosed as e:
            logger.info(f"[Bridge] WS closed for call {call_id}: code={e.code} reason={e.reason}")
            # Normal close from Vapi — don't retry
            if e.code in (1000, 1001):
                break
            attempt += 1

        except WebSocketException as e:
            logger.warning(f"[Bridge] WS error for call {call_id}: {e}")
            attempt += 1

        except Exception as e:
            logger.error(f"[Bridge] Unexpected error for call {call_id}: {e}")
            attempt += 1

        if attempt <= max_retries:
            await asyncio.sleep(2 ** attempt)  # Exponential back-off: 2s, 4s, 8s

    # Notify frontend that bridge closed
    await ws_manager.broadcast(call_id, {
        "type": "stream-closed",
        "reason": "bridge_disconnected",
    })
    logger.info(f"[Bridge] Bridge task exiting for call {call_id}")


async def start_vapi_bridge(call_id: str, listen_url: str) -> None:
    """
    Spawn a background asyncio Task that bridges Vapi WS → ws_manager.
    Safe to call multiple times — ignores duplicate requests for same call_id.
    """
    if call_id in _active_bridges and not _active_bridges[call_id].done():
        logger.info(f"[Bridge] Already running for call {call_id}, skipping")
        return

    task = asyncio.create_task(
        _bridge_task(call_id, listen_url),
        name=f"vapi-bridge-{call_id}",
    )
    _active_bridges[call_id] = task

    # Auto-cleanup when task finishes
    def _on_done(t: asyncio.Task):
        _active_bridges.pop(call_id, None)
        if t.exception():
            logger.error(f"[Bridge] Task failed for {call_id}: {t.exception()}")

    task.add_done_callback(_on_done)
    logger.info(f"[Bridge] Started bridge task for call {call_id}")


def stop_vapi_bridge(call_id: str) -> None:
    """Manually cancel the bridge for a call (e.g. on early termination)."""
    task = _active_bridges.pop(call_id, None)
    if task and not task.done():
        task.cancel()
        logger.info(f"[Bridge] Cancelled bridge for call {call_id}")


def get_active_bridges() -> list[str]:
    """Return list of call_ids with active bridge tasks."""
    return [cid for cid, t in _active_bridges.items() if not t.done()]