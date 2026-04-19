"""
VoiceAgent — Vapi Webhook Receiver
POST /webhooks/vapi

Vapi calls this endpoint for ALL server-side events.
This handles the `{ message: { type, ... } }` envelope that Vapi sends.

Supported events:
  - transcript            → live partial/final transcript segments
  - end-of-call-report    → full conversation history + summary + recording
  - call-status-update    → status changes (ringing, in-progress, ended…)
  - call-started          → call is live
  - call-ended / call-end → call terminated
  - speech-update         → talking indicators

Register in Vapi Dashboard → Settings → Webhooks → Server URL:
  https://yourdomain.com/webhooks/vapi
"""

import json
import logging

from fastapi import APIRouter, Request, Response

from app.services.ws_manager import ws_manager

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)

# Vapi status → our UI status label
STATUS_MAP = {
    "queued":        "queued",
    "ringing":       "ringing",
    "in-progress":   "active",
    "forwarding":    "active",
    "ended":         "completed",
    "no-answer":     "no-answer",
    "busy":          "busy",
    "failed":        "failed",
    "canceled":      "cancelled",
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
    Receive Vapi server events and push them into ws_manager for SSE delivery.
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

    logger.info(f"[Webhook] type={msg_type!r} call={call_id} payload={body}")

    if not call_id:
        logger.debug(f"[Webhook] No call_id for event type={msg_type!r} — skipping")
        return Response(status_code=200)

    # ── Live transcript segment (partial or final) ───────────────────────────
    if msg_type == "transcript":
        role = msg.get("role", "unknown")                         # "user" | "assistant"
        transcript_type = msg.get("transcriptType", "final")      # "partial" | "final"
        text = msg.get("transcript", "") or msg.get("message", "") or msg.get("text", "")
        if text:
            import asyncio
            asyncio.create_task(ws_manager.broadcast(call_id, {
                "type":       "transcript",
                "speaker":    "user" if role == "user" else "agent",
                "text":       text,
                "is_partial": transcript_type == "partial",
                "timestamp":  msg.get("timestamp", 0),
            }))

    # ── End-of-call report ──────────────────────────────────────────────────
    # This is the canonical final event Vapi sends — it contains the full
    # artifact.messages list which holds the entire conversation history.
    elif msg_type == "end-of-call-report":
        artifact = msg.get("artifact", {})
        recording_url = (
            msg.get("recordingUrl")
            or artifact.get("recordingUrl")
        )
        summary = (
            msg.get("summary")
            or msg.get("analysis", {}).get("summary")
        )

        import asyncio

        # Publish each message in the transcript history individually
        # so the SSE consumer can display the full conversation
        messages = artifact.get("messages", [])
        for m in messages:
            role = m.get("role", "unknown")
            text = m.get("message", "") or m.get("text", "")
            # Skip system messages
            if role == "system" or not text:
                continue
            speaker = "user" if role == "user" else "agent"
            asyncio.create_task(ws_manager.broadcast(call_id, {
                "type":       "transcript",
                "speaker":    speaker,
                "text":       text,
                "is_partial": False,
                "timestamp":  m.get("time", 0),
            }))

        # Then send the terminal call-ended event
        asyncio.create_task(ws_manager.broadcast(call_id, {
            "type":          "call-ended",
            "status":        "completed",
            "summary":       summary,
            "recording_url": recording_url,
        }))

    # ── Call status update ───────────────────────────────────────────────────
    elif msg_type in ("call-status-update", "status-update"):
        raw_status = msg.get("status", "unknown")
        import asyncio
        asyncio.create_task(ws_manager.broadcast(call_id, {
            "type":   "status-update",
            "status": STATUS_MAP.get(raw_status, raw_status),
            "raw":    raw_status,
        }))

    # ── Call started ─────────────────────────────────────────────────────────
    elif msg_type == "call-started":
        import asyncio
        asyncio.create_task(ws_manager.broadcast(call_id, {
            "type":   "status-update",
            "status": "active",
            "raw":    "in-progress",
        }))

    # ── Call ended (simple terminal signal) ──────────────────────────────────
    elif msg_type in ("call-ended", "call-end"):
        ended_reason = msg.get("endedReason", "completed")
        import asyncio
        asyncio.create_task(ws_manager.broadcast(call_id, {
            "type":         "call-ended",
            "status":       STATUS_MAP.get(ended_reason, ended_reason),
            "ended_reason": ended_reason,
        }))

    # ── Voicemail detected ───────────────────────────────────────────────────
    elif msg_type in ("voicemail", "voicemail-detected"):
        import asyncio
        asyncio.create_task(ws_manager.broadcast(call_id, {
            "type":   "status-update",
            "status": "voicemail",
        }))

    # ── Speech update (talking indicators) ───────────────────────────────────
    elif msg_type == "speech-update":
        import asyncio
        asyncio.create_task(ws_manager.broadcast(call_id, {
            "type":   "speech-update",
            "role":   msg.get("role", "unknown"),
            "status": msg.get("status", "unknown"),  # "started" | "stopped"
        }))

    else:
        logger.debug(f"[Webhook] Unhandled event type: {msg_type!r}")

    # Vapi requires a fast 200 ack
    return Response(status_code=200)
