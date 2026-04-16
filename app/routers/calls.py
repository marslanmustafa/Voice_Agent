"""
VoiceAgent — Calls Router (Pure Vapi Proxy)
GET  /calls            — list Vapi calls directly
POST /calls/dial       — Initiate an ad-hoc single call
GET  /calls/{id}       — detail with Vapi real-time fetching
POST /calls/{id}/end   — terminate active call via Vapi
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from dateutil import parser

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.db.models import User, UserConfig, Contact
from app.schemas.campaigns import (
    CallDetailResponse, CallListResponse, CallResponse, TranscriptSegmentResponse,
)
from app.services import vapi_service
from app.utils.exceptions import VapiError

router = APIRouter(prefix="/calls", tags=["calls"])
logger = logging.getLogger(__name__)


class DialRequest(BaseModel):
    phone_to: str
    system_prompt: Optional[str] = None
    first_message: Optional[str] = None


def _parse_vapi_call(v: dict, contact_map: dict) -> CallResponse:
    customer = v.get("customer", {})
    phone_to = customer.get("number", "Unknown")
    phone_from = v.get("phoneNumber", {}).get("number", "Unknown") if v.get("phoneNumber") else "Unknown"

    duration_secs = 0
    if v.get("endedAt") and v.get("startedAt"):
        try:
            start = parser.parse(v["startedAt"])
            end = parser.parse(v["endedAt"])
            duration_secs = int((end - start).total_seconds())
        except Exception:
            duration_secs = 0

    return CallResponse(
        id=v.get("id"),
        vapi_call_id=v.get("id"),
        campaign_id=v.get("campaignId"),
        contact_id=contact_map.get(phone_to),
        phone_to=phone_to,
        phone_from=phone_from,
        status=v.get("status", "unknown"),
        started_at=v.get("startedAt"),
        ended_at=v.get("endedAt"),
        duration_secs=duration_secs,
        recording_url=v.get("recordingUrl"),
        summary=v.get("summary") or v.get("analysis", {}).get("summary"),
        created_at=v.get("createdAt", ""),
    )


@router.get("", response_model=CallListResponse)
async def list_calls(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_config = await db.scalar(select(UserConfig).where(UserConfig.user_id == user.id))
    if not user_config or not user_config.vapi_assistant_id:
        return CallListResponse(calls=[], total=0)

    try:
        raw_calls = await vapi_service.list_calls(user_config.vapi_assistant_id, limit=page_size)
    except VapiError:
        raw_calls = []

    phones = [c.get("customer", {}).get("number") for c in raw_calls if c.get("customer", {}).get("number")]
    contact_map = {}
    if phones:
        local_contacts = (await db.scalars(
            select(Contact).where(Contact.user_id == user.id, Contact.phone.in_(phones))
        )).all()
        for contact in local_contacts:
            contact_map[contact.phone] = str(contact.id)

    calls = [_parse_vapi_call(c, contact_map) for c in raw_calls]
    return CallListResponse(calls=calls, total=len(calls))


@router.post("/dial")
async def dial_call(
    body: DialRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_config = await db.scalar(select(UserConfig).where(UserConfig.user_id == user.id))
    if not user_config or not user_config.vapi_assistant_id:
        raise HTTPException(status_code=400, detail="Vapi Assistant ID not configured")

    try:
        resp = await vapi_service.create_outbound_call(
            assistant_id=user_config.vapi_assistant_id,
            customer_number=body.phone_to,
            first_message=body.first_message,
            system_prompt=body.system_prompt,
        )
        listen_url = None
        monitor_block = resp.get("monitor", {})
        if isinstance(monitor_block, dict):
            listen_url = monitor_block.get("listenUrl")

        return {"ok": True, "call_id": resp.get("id"), "listen_url": listen_url}
    except VapiError as e:
        logger.error(f"[VAPI] Dial error {e.status_code}: {e.detail}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.exception("Unexpected error in dial_call")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{call_id}", response_model=CallDetailResponse)
async def get_call(
    call_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        vapi_data = await vapi_service.get_call(call_id)
        vapi_transcript = await vapi_service.get_call_transcript(call_id)
    except VapiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    phone_to = vapi_data.get("customer", {}).get("number")
    contact_map = {}
    if phone_to:
        contact = await db.scalar(select(Contact).where(Contact.user_id == user.id, Contact.phone == phone_to))
        if contact:
            contact_map[phone_to] = str(contact.id)

    transcript_segments = []
    for item in vapi_transcript:
        if isinstance(item, dict):
            speaker = item.get("role", "unknown")
            text = item.get("transcript", "") or item.get("message", "")
            transcript_segments.append(TranscriptSegmentResponse(
                speaker=speaker, text=text, timestamp=item.get("time")
            ))

    response_dict = _parse_vapi_call(vapi_data, contact_map).model_dump()
    return CallDetailResponse(**response_dict, transcript=transcript_segments)


@router.post("/{call_id}/end")
async def terminate_call(
    call_id: str,
    user: User = Depends(get_current_user),
):
    try:
        await vapi_service.end_call(call_id)
    except VapiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.exception("Unexpected error in terminate_call")
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True}