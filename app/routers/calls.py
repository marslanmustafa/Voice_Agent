"""
VoiceAgent — Calls Router (Pure Vapi Proxy)
GET  /calls            — list Vapi calls directly
POST /calls/dial       — Initiate an ad-hoc single call
GET  /calls/{id}       — detail with Vapi real-time fetching
GET  /calls/{id}/stream — SSE stream for live status + transcript
POST /calls/{id}/end   — terminate active call via Vapi
"""

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from dateutil import parser

from app.core.config import settings
from app.core.dependencies import SYSTEM_USER_ID, get_current_user
from app.db.database import get_db
from app.db.models import User, Contact
from app.schemas.campaigns import (
    CallDetailResponse, CallListResponse, CallResponse, TranscriptSegmentResponse,
)
from app.services import vapi_service
from app.services.ws_manager import ws_manager
from app.utils.exceptions import VapiError
from app.utils.vapi_ws_bridge import start_vapi_bridge, stop_vapi_bridge

router = APIRouter(prefix="/calls", tags=["calls"])
logger = logging.getLogger(__name__)


class DialRequest(BaseModel):
    phone_to: str
    system_prompt: Optional[str] = None
    first_message: Optional[str] = None


def _parse_vapi_call(v: dict, contact_map: dict) -> CallResponse:
    customer = v.get("customer", {})
    phone_to = customer.get("number", "Unknown")

    phone_number_block = v.get("phoneNumber", {})
    phone_from = (
        phone_number_block.get("number")
        or phone_number_block.get("twilioPhoneNumber")
        or "Unknown"
    ) if isinstance(phone_number_block, dict) else "Unknown"

    duration_secs = 0
    if v.get("endedAt") and v.get("startedAt"):
        try:
            start = parser.parse(v["startedAt"])
            end = parser.parse(v["endedAt"])
            duration_secs = int((end - start).total_seconds())
        except Exception:
            duration_secs = 0

    raw_status = v.get("status", "unknown")
    status = _normalize_status(raw_status)

    return CallResponse(
        id=v.get("id"),
        vapi_call_id=v.get("id"),
        campaign_id=v.get("campaignId"),
        contact_id=contact_map.get(phone_to),
        phone_to=phone_to,
        phone_from=phone_from,
        status=status,
        started_at=v.get("startedAt"),
        ended_at=v.get("endedAt"),
        duration_secs=duration_secs,
        recording_url=v.get("recordingUrl") or v.get("artifact", {}).get("recordingUrl"),
        summary=v.get("summary") or v.get("analysis", {}).get("summary"),
        cost=v.get("cost") or v.get("analysis", {}).get("cost") or 0.0,
        ended_reason=v.get("endedReason"),
        created_at=v.get("createdAt", ""),
    )


def _normalize_status(vapi_status: str) -> str:
    mapping = {
        "queued":      "dialing",
        "ringing":     "ringing",
        "in-progress": "active",
        "forwarding":  "active",
        "ended":       "completed",
        "failed":      "failed",
        "no-answer":   "no-answer",
        "busy":        "busy",
        "canceled":    "cancelled",
        "dialing":     "dialing",
        "active":      "active",
        "completed":   "completed",
    }
    return mapping.get(vapi_status.lower(), vapi_status)


@router.get("", response_model=CallListResponse)
async def list_calls(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    assistant_id = settings.VAPI_ASSISTANT_ID
    if not assistant_id:
        return CallListResponse(calls=[], total=0)

    try:
        raw_calls = await vapi_service.list_calls(assistant_id, limit=page_size)
    except VapiError:
        raw_calls = []

    phones = [
        c.get("customer", {}).get("number")
        for c in raw_calls
        if c.get("customer", {}).get("number")
    ]
    contact_map = {}
    if phones:
        local_contacts = (await db.scalars(
            select(Contact).where(Contact.user_id == SYSTEM_USER_ID, Contact.phone.in_(phones))
        )).all()
        for contact in local_contacts:
            contact_map[contact.phone] = str(contact.id)

    calls = [_parse_vapi_call(c, contact_map) for c in raw_calls]
    return CallListResponse(calls=calls, total=len(calls))


@router.post("/dial")
async def dial_call(
    body: DialRequest,
    _: User = Depends(get_current_user),
):
    assistant_id = settings.VAPI_ASSISTANT_ID
    if not assistant_id:
        raise HTTPException(status_code=400, detail="VAPI_ASSISTANT_ID is not configured in .env")

    try:
        resp = await vapi_service.create_outbound_call(
            assistant_id=assistant_id,
            customer_number=body.phone_to,
            first_message=body.first_message,
            system_prompt=body.system_prompt,
        )

        call_id = resp.get("id")
        monitor_block = resp.get("monitor", {})
        listen_url = None
        control_url = None

        if isinstance(monitor_block, dict):
            listen_url = monitor_block.get("listenUrl")
            control_url = monitor_block.get("controlUrl")

        if call_id and listen_url:
            await start_vapi_bridge(call_id, listen_url)
        elif call_id:
            logger.warning(
                f"[Dial] No listenUrl in Vapi response for call {call_id}. "
                "Live transcript will rely on webhook fallback only."
            )

        return {
            "ok": True,
            "call_id": call_id,
            "status": _normalize_status(resp.get("status", "dialing")),
            "listen_url": listen_url,
            "control_url": control_url,
        }

    except VapiError as e:
        logger.error(f"[Dial] Vapi error {e.status_code}: {e.detail}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.exception("Unexpected error in dial_call")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{call_id}/stream")
async def stream_call_events(call_id: str):
    """
    SSE stream for live call status and transcript.
    Auth-free — accessible to anyone who knows the call_id.

    Frontend usage:
      const es = new EventSource(`/calls/${callId}/stream`);
    """
    message_queue: asyncio.Queue[str] = asyncio.Queue(maxsize=200)

    async def on_message(data: dict) -> None:
        try:
            await message_queue.put_nowait(json.dumps(data))
        except asyncio.QueueFull:
            logger.warning(f"[SSE] Queue full for call {call_id}, dropping message")

    await ws_manager.subscribe(call_id, on_message)

    async def event_generator():
        yield f"data: {json.dumps({'type': 'connected', 'call_id': call_id})}\n\n"

        try:
            while True:
                try:
                    msg = await asyncio.wait_for(message_queue.get(), timeout=25.0)
                    yield f"data: {msg}\n\n"

                    try:
                        payload = json.loads(msg)
                        if payload.get("type") in ("call-ended", "stream-closed"):
                            yield f"data: {json.dumps({'type': 'stream-closed'})}\n\n"
                            return
                    except Exception:
                        pass

                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"

        except asyncio.CancelledError:
            pass
        finally:
            ws_manager.unsubscribe(call_id, on_message)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
            "Connection":        "keep-alive",
        },
    )


@router.get("/{call_id}", response_model=CallDetailResponse)
async def get_call(
    call_id: str,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        vapi_data = await vapi_service.get_call(call_id)
        # Prefer artifact.messages which is more structured
        messages = vapi_data.get("artifact", {}).get("messages", [])
        if not messages:
            messages = await vapi_service.get_call_transcript(call_id)
    except VapiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    phone_to = vapi_data.get("customer", {}).get("number")
    contact_map = {}
    if phone_to:
        contact = await db.scalar(
            select(Contact).where(Contact.user_id == SYSTEM_USER_ID, Contact.phone == phone_to)
        )
        if contact:
            contact_map[phone_to] = str(contact.id)

    transcript_segments = []
    for item in messages:
        if isinstance(item, dict):
            role = item.get("role", "unknown")
            # Only include user/assistant/bot roles in the transcript view
            if role in ("system", "tool"): continue
            
            speaker = "user" if role == "user" else "agent"
            text = (
                item.get("transcript") 
                or item.get("message") 
                or item.get("text")
            )
            # Skip system instructions that sometimes leak into transcript blocks
            if not text or text.startswith("#"): continue
            
            transcript_segments.append(TranscriptSegmentResponse(
                speaker=speaker,
                role=role,
                text=text.strip(),
                timestamp=item.get("time") or item.get("timestamp"),
                time=item.get("time") or item.get("timestamp"),
            ))

    response_dict = _parse_vapi_call(vapi_data, contact_map).model_dump()
    return CallDetailResponse(**response_dict, transcript=transcript_segments)


@router.post("/{call_id}/end")
async def terminate_call(
    call_id: str,
    _: User = Depends(get_current_user),
):
    try:
        await vapi_service.end_call(call_id)
        stop_vapi_bridge(call_id)
    except VapiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.exception("Unexpected error in terminate_call")
        raise HTTPException(status_code=500, detail=str(e))

    return {"ok": True}