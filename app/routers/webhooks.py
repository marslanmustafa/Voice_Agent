"""
Vapi webhook receiver — handles all server-sent events from Vapi.
Event types we care about:
  call-status-update  → ringing / in-progress / ended / no-answer / busy / failed
  transcript          → partial or final transcript segment
  end-of-call-report  → summary, full transcript, recording URL
"""

import json
import logging

from fastapi import APIRouter, Request, HTTPException

from app.services.ws_manager import ws_manager

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)

# Vapi status → our UI status label
STATUS_MAP = {
    "queued":        "queued",
    "ringing":       "ringing",
    "in-progress":   "in-progress",
    "forwarding":    "forwarding",
    "ended":         "ended",
    "no-answer":     "no-answer",
    "busy":          "busy",
    "failed":        "failed",
    "canceled":      "canceled",
}


def _extract_call_id(body: dict) -> str | None:
    """Safely extract call ID from various Vapi webhook shapes."""
    msg = body.get("message", {})
    call_id = (
        msg.get("call", {}).get("id")
        or body.get("call", {}).get("id")
        or body.get("callId")
        or msg.get("callId")
    )
    return call_id


@router.post("/vapi")
async def vapi_webhook(request: Request):
    """
    Receive and broadcast Vapi events to all connected WebSocket clients.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    msg_type = body.get("message", {}).get("type") or body.get("type", "")
    call_id = _extract_call_id(body)

    if not call_id:
        logger.debug(f"[WEBHOOK] No call_id in event: {msg_type}")
        return {"received": True}

    logger.info(f"[WEBHOOK] {msg_type} | call={call_id}")

    # ── Call status update ──────────────────────────────────────────
    if msg_type in ("call-status-update", "status-update"):
        raw = body.get("message", {}).get("status") or body.get("status", "unknown")
        status = STATUS_MAP.get(raw, raw)
        await ws_manager.broadcast(call_id, {
            "type": "status",
            "status": status,
            "raw": raw,
        })

    # ── Call started ────────────────────────────────────────────────
    elif msg_type == "call-started":
        await ws_manager.broadcast(call_id, {
            "type": "status",
            "status": "in-progress",
            "raw": "in-progress",
        })

    # ── Transcript segment (partial or final) ───────────────────────
    elif msg_type in ("transcript", "transcript-update"):
        msg = body.get("message", body)
        role = msg.get("role", "unknown")          # "user" or "assistant"
        text = (
            msg.get("transcript", "")
            or msg.get("transcriptWithFormatting", "")
            or ""
        )
        transcript_type = msg.get("transcriptType", "final")  # "partial" | "final"
        if text:
            await ws_manager.broadcast(call_id, {
                "type":        "transcript",
                "speaker":     role,
                "text":        text,
                "transcript_type": transcript_type,
                "timestamp":   msg.get("timestamp", 0),
            })

    # ── Call ended ─────────────────────────────────────────────────
    elif msg_type in ("call-ended", "call-end"):
        ended_reason = body.get("message", {}).get("endedReason", "completed")
        await ws_manager.broadcast(call_id, {
            "type":           "call-ended",
            "status":         STATUS_MAP.get(ended_reason, ended_reason),
            "ended_reason":   ended_reason,
        })

    # ── End of call report (has full transcript + summary) ───────────
    elif msg_type == "end-of-call-report":
        msg = body.get("message", body)
        summary = (
            msg.get("summary")
            or msg.get("analysis", {}).get("summary")
            or None
        )
        recording_url = (
            msg.get("recordingUrl")
            or msg.get("artifact", {}).get("recordingUrl")
            or None
        )
        await ws_manager.broadcast(call_id, {
            "type":           "end-of-call",
            "status":         "completed",
            "summary":        summary,
            "recording_url":  recording_url,
            "transcript_text": msg.get("transcript", ""),
        })

    # ── Call failed ─────────────────────────────────────────────────
    elif msg_type == "call-failed":
        reason = body.get("message", {}).get("reason", "failed")
        await ws_manager.broadcast(call_id, {
            "type":   "status",
            "status": STATUS_MAP.get(reason, "failed"),
            "raw":    reason,
        })

    # ── Voicemail detection ─────────────────────────────────────────
    elif msg_type in ("voicemail", "voicemail-detected"):
        await ws_manager.broadcast(call_id, {
            "type":   "status",
            "status": "voicemail",
        })

    # ── Queue / ringing ─────────────────────────────────────────────
    elif msg_type in ("queue", "call-queued"):
        await ws_manager.broadcast(call_id, {
            "type":   "status",
            "status": "queued",
        })

    else:
        logger.debug(f"[WEBHOOK] Unhandled event type: {msg_type}")

    return {"received": True}
