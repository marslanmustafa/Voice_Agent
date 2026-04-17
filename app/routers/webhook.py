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

import logging

from fastapi import APIRouter, Request, Response

from app.services.ws_manager import ws_manager
from app.utils.vapi_ws_bridge import normalize_vapi_event

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)


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

    if not call_id:
        logger.warning("[Webhook] No call ID in Vapi event — skipping broadcast")
        return Response(status_code=200)

    # Normalize and broadcast (fire-and-forget, don't await long work)
    normalized = normalize_vapi_event(payload)
    if normalized:
        import asyncio
        asyncio.create_task(ws_manager.broadcast(call_id, normalized))

    # Vapi needs a fast 200 ack — return immediately
    return Response(status_code=200)