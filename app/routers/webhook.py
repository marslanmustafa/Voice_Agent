"""
VoiceAgent — Vapi Webhook Router
POST /vapi/webhook  — receive Vapi call lifecycle events
GET  /vapi/webhook  — Vapi URL verification ping
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.services.ws_manager import ws_manager

router = APIRouter(prefix="/vapi", tags=["vapi"])

# Vapi endedReason values that map to our statuses
_ENDED_STATUS_MAP = {
    "customer-ended-call": "completed",
    "assistant-ended-call": "completed",
    "voicemail": "voicemail",
    "machine-detected": "voicemail",
    "silence-timed-out": "failed",
    "max-duration-exceeded": "completed",
    "customer-busy": "failed",
    "no-answer": "failed",
    "failed": "failed",
}


@router.get("/webhook")
async def vapi_webhook_ping():
    """Vapi sends GET to verify webhook URL is reachable."""
    return {"status": "ok"}


@router.post("/webhook")
async def vapi_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Handle Vapi call events:
    - call-started       → record started_at, broadcast to WebSocket
    - transcript         → broadcast to WebSocket (NO DB SAVE)
    - call-ended         → record ended_at, broadcast to WebSocket
    - end-of-call-report → broadcast to WebSocket
    - call-failed        → record ended_at, broadcast to WebSocket
    """
    try:
        payload = await request.json()
    except Exception:
        return {"status": "bad_request"}

    message = payload.get("message", {})
    event: str = message.get("type", "")
    vapi_call_id: str | None = message.get("call", {}).get("id")

    if not event or not vapi_call_id:
        return {"status": "ignored"}

    if event == "call-started":
        await ws_manager.broadcast(vapi_call_id, {"type": "call-started", "status": "active"})

    elif event == "transcript":
        role = message.get("role", "unknown")
        text = message.get("transcript", "")
        timestamp = message.get("timestamp", 0.0)
        if text:
            # Broadcast live to UI, do not save to DB
            await ws_manager.broadcast(vapi_call_id, {
                "type": "transcript", "speaker": role, "text": text, "timestamp": timestamp,
            })

    elif event == "call-ended":
        ended_reason = message.get("endedReason", "completed")
        mapped_status = _ENDED_STATUS_MAP.get(ended_reason, "completed")
        
        await ws_manager.broadcast(vapi_call_id, {
            "type": "call-ended",
            "status": mapped_status,
            "duration_secs": message.get("durationSeconds"),
        })

    elif event == "end-of-call-report":
        await ws_manager.broadcast(vapi_call_id, {
            "type": "call-ended",
            "status": "completed"
        })

    elif event == "call-failed":
        await ws_manager.broadcast(vapi_call_id, {"type": "call-failed", "status": "failed"})

    elif event == "voicemail":
        await ws_manager.broadcast(vapi_call_id, {"type": "call-ended", "status": "voicemail"})

    return {"status": "ok"}
