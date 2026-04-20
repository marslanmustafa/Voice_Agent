"""
VoiceAgent — Vapi Webhook Receiver
POST /webhooks/vapi

Vapi calls this endpoint for server-side events (status changes, transcripts,
end-of-call reports). This is the fallback path when the WS bridge isn't
running or misses events.

Register this URL in your Vapi dashboard:
  Dashboard → Settings → Webhooks → Server URL
  → https://yourdomain.com/webhooks/vapi
"""

import asyncio
import json
import logging
import os
from pathlib import Path

from fastapi import APIRouter, Request, Response

from app.services.ws_manager import ws_manager
from app.utils.vapi_ws_bridge import normalize_vapi_event

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)

_LOG_DIR = Path("./log")


async def _save_event(call_id: str | None, payload: dict, msg_type: str) -> None:
    """Append a webhook event to ./log/{callId}.txt (fire-and-forget)."""
    if not call_id:
        return
    try:
        _LOG_DIR.mkdir(parents=True, exist_ok=True)
        log_path = _LOG_DIR / f"{call_id}.txt"
        timestamp = payload.get("timestamp") or payload.get("time") or ""
        entry = f"[{timestamp}] {msg_type}\n{json.dumps(payload, indent=2)}\n{'='*60}\n"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(entry)
    except Exception as exc:
        logger.error(f"[Webhook] Failed to write event log: {exc}")


@router.post("/vapi")
async def vapi_webhook(request: Request):
    """
    Receive Vapi server events and push them into ws_manager.

    Vapi REQUIRES a 200 response quickly — heavy work must be fire-and-forget.
    """
    try:
        payload = await request.json()
    except Exception:
        return Response(status_code=400)

    msg_type = payload.get("type", "")
    call_id = (
        payload.get("call", {}).get("id")
        or payload.get("callId")
        or payload.get("id")
    )

    logger.info(f"[Webhook] Vapi event: type={msg_type} call={call_id}")

    # Save event to log file asynchronously (fire-and-forget)
    asyncio.create_task(_save_event(call_id, payload, msg_type))

    if not call_id:
        logger.warning("[Webhook] No call ID in Vapi event — skipping broadcast")
        return Response(status_code=200)

    # Normalize and broadcast (fire-and-forget, don't await long work)
    normalized = normalize_vapi_event(payload)
    if normalized:
        asyncio.create_task(ws_manager.broadcast(call_id, normalized))

    # Vapi needs a fast 200 ack — return immediately
    return Response(status_code=200)