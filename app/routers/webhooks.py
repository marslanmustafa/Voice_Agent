"""
VoiceAgent — Vapi Webhook Receiver
POST /webhooks/vapi

Vapi calls this endpoint for ALL server-side events.
This handles the `{ message: { type, ... } }` envelope that Vapi sends.

Supported events (based on real log analysis):
  - conversation-update  → full messages array after every turn (PRIMARY transcript source)
  - speech-update        → who is speaking started/stopped
  - user-interrupted     → user cut off the assistant
  - end-of-call-report   → call summary + recording URL
  - call-status-update   → status changes (ringing, in-progress, ended…)
  - call-started         → call is live
  - call-ended / call-end→ call terminated
  - transcript           → (legacy) partial/final transcript segment

Register in Vapi Dashboard → Settings → Webhooks → Server URL:
  https://yourdomain.com/webhooks/vapi
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Request, Response

from app.services.ws_manager import ws_manager

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)

# ── Webhook file logger ────────────────────────────────────────────────────────

LOGS_DIR = Path("logs")
LOGS_DIR.mkdir(exist_ok=True)


async def _log_webhook(body: dict, msg_type: str, call_id: str | None) -> None:
    """Append the raw webhook payload to a daily JSONL log file (fire-and-forget)."""
    now = datetime.now(timezone.utc)
    log_file = LOGS_DIR / f"webhooks_{now.strftime('%Y-%m-%d')}.jsonl"
    entry = {
        "ts":      now.isoformat(),
        "type":    msg_type,
        "call_id": call_id,
        "payload": body,
    }
    try:
        async with aiofiles.open(log_file, mode="a", encoding="utf-8") as f:
            await f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as exc:
        logger.warning(f"[Webhook] Failed to write log: {exc}")


# Vapi status → our UI status label
STATUS_MAP = {
    "queued":      "queued",
    "ringing":     "ringing",
    "in-progress": "active",
    "forwarding":  "active",
    "ended":       "completed",
    "no-answer":   "no-answer",
    "busy":        "busy",
    "failed":      "failed",
    "canceled":    "cancelled",
}


def _extract_call_id(body: dict) -> str | None:
    """
    Extract call ID from Vapi webhook body.
    Vapi wraps events in: { message: { type, call: { id } } }
    But also sometimes sends callId at top-level.
    """
    msg = body.get("message", {})
    return (
        msg.get("call", {}).get("id")
        or body.get("call", {}).get("id")
        or body.get("callId")
        or msg.get("callId")
    )


@router.post("/vapi")
async def vapi_webhook(request: Request):
    """
    Receive Vapi server events and push them into ws_manager for WebSocket delivery.
    Vapi requires a fast 200 response — all work is fire-and-forget.
    """
    try:
        body = await request.json()
    except Exception:
        return Response(status_code=400)

    # Vapi wraps all events inside a "message" object
    msg = body.get("message", body)   # fall back to body if no envelope
    msg_type = msg.get("type", "")
    call_id = _extract_call_id(body)

    logger.info(f"[Webhook] type={msg_type!r} call={call_id}")

    # Fire-and-forget: write raw payload to daily log file
    asyncio.create_task(_log_webhook(body, msg_type, call_id))

    if not call_id:
        logger.debug(f"[Webhook] No call_id for event type={msg_type!r} — skipping broadcast")
        return Response(status_code=200)

    # ── conversation-update — PRIMARY transcript source ───────────────────────
    # Vapi sends full messages array after every turn.
    # roles: "bot" (assistant), "user", "system"
    # Fields per message: message (text), time (epoch ms), secondsFromStart
    if msg_type == "conversation-update":
        messages = msg.get("messages", [])
        for m in messages:
            role = m.get("role", "unknown")
            text = m.get("message", "") or m.get("text", "") or m.get("content", "")
            if role == "system" or not text:
                continue
            asyncio.create_task(ws_manager.broadcast(call_id, {
                "type":       "transcript",
                "speaker":    "user" if role == "user" else "agent",
                "text":       text,
                "is_partial": False,
                "timestamp":  m.get("time", 0),
                "secs":       round(m.get("secondsFromStart", 0), 1),
            }))

    # ── speech-update — talking indicators ────────────────────────────────────
    elif msg_type == "speech-update":
        asyncio.create_task(ws_manager.broadcast(call_id, {
            "type":   "speech-update",
            "role":   msg.get("role", "unknown"),    # "user" | "assistant"
            "status": msg.get("status", "unknown"),  # "started" | "stopped"
        }))

    # ── user-interrupted ──────────────────────────────────────────────────────
    elif msg_type == "user-interrupted":
        asyncio.create_task(ws_manager.broadcast(call_id, {
            "type": "user-interrupted",
        }))

    # ── end-of-call-report ────────────────────────────────────────────────────
    elif msg_type == "end-of-call-report":
        artifact  = msg.get("artifact", {})
        summary   = msg.get("summary") or msg.get("analysis", {}).get("summary")
        rec_url   = msg.get("recordingUrl") or artifact.get("recordingUrl")
        dur_secs  = msg.get("durationSeconds") or msg.get("duration_secs")
        asyncio.create_task(ws_manager.broadcast(call_id, {
            "type":          "call-ended",
            "status":        "completed",
            "summary":       summary,
            "recording_url": rec_url,
            "duration_secs": dur_secs,
        }))

    # ── call-status-update / status-update ────────────────────────────────────
    elif msg_type in ("call-status-update", "status-update"):
        raw_status = msg.get("status", "unknown")
        asyncio.create_task(ws_manager.broadcast(call_id, {
            "type":   "status-update",
            "status": STATUS_MAP.get(raw_status, raw_status),
            "raw":    raw_status,
        }))

    # ── call-started ──────────────────────────────────────────────────────────
    elif msg_type == "call-started":
        asyncio.create_task(ws_manager.broadcast(call_id, {
            "type":   "status-update",
            "status": "active",
            "raw":    "in-progress",
        }))

    # ── call-ended / call-end ─────────────────────────────────────────────────
    elif msg_type in ("call-ended", "call-end"):
        ended_reason = msg.get("endedReason", "completed")
        asyncio.create_task(ws_manager.broadcast(call_id, {
            "type":         "call-ended",
            "status":       STATUS_MAP.get(ended_reason, ended_reason),
            "ended_reason": ended_reason,
        }))

    # ── voicemail ─────────────────────────────────────────────────────────────
    elif msg_type in ("voicemail", "voicemail-detected"):
        asyncio.create_task(ws_manager.broadcast(call_id, {
            "type":   "status-update",
            "status": "voicemail",
        }))

    # ── transcript (legacy fallback) ──────────────────────────────────────────
    elif msg_type == "transcript":
        role = msg.get("role", "unknown")
        text = msg.get("transcript", "") or msg.get("message", "") or msg.get("text", "")
        if text:
            asyncio.create_task(ws_manager.broadcast(call_id, {
                "type":       "transcript",
                "speaker":    "user" if role == "user" else "agent",
                "text":       text,
                "is_partial": msg.get("transcriptType", "final") == "partial",
                "timestamp":  msg.get("timestamp", 0),
                "secs":       None,
            }))

    else:
        logger.debug(f"[Webhook] Unhandled event type: {msg_type!r}")

    # Vapi requires a fast 200 ack
    return Response(status_code=200)
