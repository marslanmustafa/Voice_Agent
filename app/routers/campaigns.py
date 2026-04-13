"""
VoiceAgent — Campaigns Router
Pure Vapi Proxy for Campaigns. No local DB dependency.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_current_user
from app.db.models import User
from app.schemas.campaigns import (
    CampaignCreate, CampaignListResponse, CampaignResponse,
)
from app.services import vapi_service

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def _parse_vapi_campaign(c: dict) -> CampaignResponse:
    return CampaignResponse(
        id=c.get("id"),
        name=c.get("name", "Unnamed Campaign"),
        topic="Vapi Campaign", # Vapi doesn't hold topics usually, placeholder
        vapi_campaign_id=c.get("id"),
        status=c.get("status", "unknown"),
        created_at=c.get("createdAt", ""),
        contact_count=0, # Hard to know without fetching contacts array in Vapi
        call_count=0,
        completed_count=0,
    )


@router.get("", response_model=CampaignListResponse)
async def list_campaigns(
    status: Optional[str] = None,
    user: User = Depends(get_current_user),
):
    try:
        raw_campaigns = await vapi_service.list_campaigns()
    except Exception as e:
        raw_campaigns = []
        
    # Vapi list_campaigns could return an array directly if mocked, or object dict {"results": [...]}
    if isinstance(raw_campaigns, dict) and "results" in raw_campaigns:
        raw_campaigns = raw_campaigns["results"]

    responses = [_parse_vapi_campaign(c) for c in raw_campaigns if isinstance(c, dict)]
    
    if status is not None:
        responses = [r for r in responses if r.status == status]

    return CampaignListResponse(campaigns=responses, total=len(responses))


@router.post("", response_model=CampaignResponse, status_code=201)
async def create_campaign(
    body: CampaignCreate,
    user: User = Depends(get_current_user),
):
    # This is slightly redundant now that we have Dialer natively, 
    # but keeping it intact strictly for proxying backward-compatibility.
    # Note: Vapi requires assistant_id. We fetch it usually from UserConfig.
    # We will raise error as we recommend the Dialer.
    raise HTTPException(status_code=400, detail="Use the Dialer to initiate ad-hoc calls natively, or Vapi Dashboard for large campaigns.")


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: str,
    user: User = Depends(get_current_user),
):
    try:
        c = await vapi_service.get_campaign_stats(campaign_id)
        return _parse_vapi_campaign(c)
    except Exception:
        raise HTTPException(status_code=404, detail="Campaign not found in Vapi")


@router.post("/{campaign_id}/launch")
async def launch_campaign(
    campaign_id: str,
    user: User = Depends(get_current_user),
):
    try:
        await vapi_service.start_campaign(campaign_id)
        return {"ok": True, "message": "Campaign launched on Vapi"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vapi error: {str(e)}")


@router.post("/{campaign_id}/cancel")
async def cancel_campaign(
    campaign_id: str,
    user: User = Depends(get_current_user),
):
    try:
        await vapi_service.stop_campaign(campaign_id)
        return {"ok": True, "message": "Campaign cancelled on Vapi"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vapi error: {str(e)}")
