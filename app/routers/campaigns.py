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
    """
    Proxies requests to Vapi's /campaign endpoint.

    phoneNumberId is required per Vapi documentation. If not provided,
    attempts to fetch assistantId from env (VAPI_ASSISTANT_ID).

    Customers (contacts) can be provided during creation and will be
    added to the campaign immediately after creation.
    """
    # Validate phoneNumberId is a valid UUID
    try:
        uuid.UUID(body.phoneNumberId)
    except ValueError:
        raise HTTPException(status_code=400, detail="phoneNumberId must be a valid UUID")

    # If assistantId not provided, fall back to env var
    assistant_id = body.assistantId or settings.VAPI_ASSISTANT_ID or None

    if not assistant_id:
        raise HTTPException(
            status_code=400,
            detail="assistantId is required. Configure it in Settings or provide it explicitly.",
        )

    # Build payload with validated assistantId
    payload = body.model_dump(exclude_unset=True, exclude_none=True)
    payload["assistantId"] = assistant_id

    # Extract customers before sending to Vapi (Vapi creates campaign first, then contacts)
    customers = payload.pop("customers", None)

    try:
        resp = await vapi_service.create_campaign(payload)

        # Add contacts to the campaign if provided
        if customers:
            contact_payload = [c.model_dump(exclude_unset=True, exclude_none=True) if hasattr(c, 'model_dump') else c for c in customers]
            contact_payload = [c for c in contact_payload if c]  # Filter empty dicts
            if contact_payload:
                await vapi_service.add_campaign_contacts(resp.get("id"), contact_payload)

        return CampaignResponse(
            id=resp.get("id"),
            name=resp.get("name", ""),
            status=resp.get("status", "draft"),
            created_at=resp.get("createdAt", ""),
        )
    except VapiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.exception("Unexpected error in create_campaign")
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