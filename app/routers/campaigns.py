"""
VoiceAgent — Campaigns Router
Proxy for Vapi Campaigns.
"""

import logging
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.models import User
from app.schemas.campaigns import (
    CreateCampaignDTO, CreateCustomerDTO, CampaignResponse, CampaignListResponse, UpdateCampaignDTO,
)
from app.services import vapi_service
from app.utils.exceptions import VapiError

router = APIRouter(prefix="/campaigns", tags=["campaigns"])
logger = logging.getLogger(__name__)


def _parse_vapi_campaign(c: dict) -> CampaignResponse:
    return CampaignResponse(
        id=c.get("id"),
        name=c.get("name", "Unnamed Campaign"),
        status=c.get("status", "unknown"),
        created_at=c.get("createdAt", ""),
        callsCounterScheduled=c.get("callsCounterScheduled", 0),
        callsCounterQueued=c.get("callsCounterQueued", 0),
        callsCounterInProgress=c.get("callsCounterInProgress", 0),
        callsCounterEndedVoicemail=c.get("callsCounterEndedVoicemail", 0),
        callsCounterEnded=c.get("callsCounterEnded", 0),
    )


@router.get("", response_model=CampaignListResponse)
async def list_campaigns(
    user: User = Depends(get_current_user),
):
    try:
        raw_campaigns = await vapi_service.list_campaigns()
    except VapiError:
        raw_campaigns = []

    if isinstance(raw_campaigns, dict) and "results" in raw_campaigns:
        raw_campaigns = raw_campaigns["results"]

    responses = [_parse_vapi_campaign(c) for c in raw_campaigns if isinstance(c, dict)]
    return CampaignListResponse(campaigns=responses, total=len(responses))


@router.get("/phone-numbers")
async def list_phone_numbers(
    user: User = Depends(get_current_user),
):
    """
    List available phone numbers from Vapi.
    """
    try:
        resp = await vapi_service.list_phone_numbers()
        return resp
    except VapiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.exception("Unexpected error in list_phone_numbers")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    user: User = Depends(get_current_user),
):
    """
    Get campaign details from Vapi.
    """
    try:
        resp = await vapi_service.get_campaign(campaign_id)
        return resp
    except VapiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.exception("Unexpected error in get_campaign")
        raise HTTPException(status_code=500, detail=str(e))





@router.patch("/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    body: UpdateCampaignDTO,
    user: User = Depends(get_current_user),
):
    """
    Update campaign details in Vapi.
    """
    # Validate phoneNumberId if provided
    if body.phoneNumberId:
        try:
            uuid.UUID(body.phoneNumberId)
        except ValueError:
            raise HTTPException(status_code=400, detail="phoneNumberId must be a valid UUID")

    payload = body.model_dump(exclude_unset=True, exclude_none=True)
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        resp = await vapi_service.update_campaign(campaign_id, payload)
        return resp
    except VapiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.exception("Unexpected error in update_campaign")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create", response_model=CampaignResponse, status_code=201)
async def create_campaign(
    body: CreateCampaignDTO,
    user: User = Depends(get_current_user),
):
    try:
        assistant_id = body.assistantId or settings.VAPI_ASSISTANT_ID

        if not assistant_id:
            raise HTTPException(
                status_code=400,
                detail="assistantId is required"
            )

        # Build payload
        payload = body.model_dump(exclude_unset=True, exclude_none=True)
        payload["assistantId"] = assistant_id

        # 🔥 CRITICAL FIX: DO NOT POP customers
        # Instead normalize them properly
        if "customers" in payload and payload["customers"]:
            payload["customers"] = [
                {
                    "phoneNumber": c.get("phoneNumber") or c.get("number"),
                    "name": c.get("name"),
                    "email": c.get("email"),
                }
                for c in payload["customers"]
            ]

            # remove invalid entries
            payload["customers"] = [
                c for c in payload["customers"]
                if c.get("phoneNumber")
            ]

        # 🚀 SINGLE CALL ONLY (NO SECOND STEP)
        resp = await vapi_service.create_campaign(payload)

        return CampaignResponse(
            id=resp.get("id"),
            name=resp.get("name", ""),
            status=resp.get("status", "draft"),
            created_at=resp.get("createdAt", ""),
        )

    except VapiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    except Exception as e:
        logger.exception("create_campaign failed")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{campaign_id}/contacts")
async def add_campaign_contacts(
    campaign_id: str,
    customers: List[CreateCustomerDTO],
    user: User = Depends(get_current_user),
):
    """
    Add contacts to an existing campaign.
    """
    try:
        payload = [c.model_dump(exclude_unset=True, exclude_none=True) for c in customers]
        if not payload:
            raise HTTPException(status_code=400, detail="No contacts provided")

        await vapi_service.add_campaign_contacts(campaign_id, payload)
        return {"ok": True, "message": f"{len(payload)} contacts added."}
    except VapiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in add_campaign_contacts")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{campaign_id}/start")
async def start_campaign(
    campaign_id: str,
    customers: List[CreateCustomerDTO] | None = None,
    user: User = Depends(get_current_user),
):
    """
    Add contacts to campaign (if provided) and start the campaign.
    """
    try:
        if customers:
            payload = [c.model_dump(exclude_unset=True, exclude_none=True) for c in customers]
            payload = [c for c in payload if c]  # Filter empty dicts
            if payload:
                await vapi_service.add_campaign_contacts(campaign_id, payload)

        await vapi_service.start_campaign(campaign_id)
        return {"ok": True, "message": "Campaign started successfully."}
    except VapiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.exception("Unexpected error in start_campaign")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{campaign_id}/control")
async def control_campaign(
    campaign_id: str,
    action: str,
    user: User = Depends(get_current_user),
):
    try:
        if action == "stop":
            await vapi_service.stop_campaign(campaign_id)
        return {"ok": True, "message": f"Campaign {action} triggered."}
    except VapiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.exception("Unexpected error in control_campaign")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: str,
    user: User = Depends(get_current_user),
):
    try:
        await vapi_service.stop_campaign(campaign_id)
        return {"ok": True, "message": "Campaign stopped/removed."}
    except VapiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.exception("Unexpected error in delete_campaign")
        raise HTTPException(status_code=500, detail=str(e))