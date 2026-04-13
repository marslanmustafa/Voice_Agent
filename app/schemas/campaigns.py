"""
VoiceAgent — Campaign & Call Schemas
"""
from typing import List, Optional
from pydantic import BaseModel


# ── Campaigns ──────────────────────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    name: str
    topic: Optional[str] = None
    contact_ids: Optional[List[str]] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    topic: Optional[str] = None


class CampaignResponse(BaseModel):
    id: str
    name: str
    topic: Optional[str]
    vapi_campaign_id: Optional[str] = None
    status: str = "draft"
    created_at: str
    contact_count: int = 0
    call_count: int = 0
    completed_count: int = 0


class CampaignListResponse(BaseModel):
    campaigns: List[CampaignResponse]
    total: int


# ── Calls ──────────────────────────────────────────────────────────────────────

class CallResponse(BaseModel):
    id: str
    campaign_id: Optional[str]
    contact_id: Optional[str]
    vapi_call_id: Optional[str]
    phone_to: str
    phone_from: str
    status: str = "unknown"
    started_at: Optional[str]
    ended_at: Optional[str]
    duration_secs: Optional[int] = None
    recording_url: Optional[str] = None
    summary: Optional[str] = None
    created_at: str


class TranscriptSegmentResponse(BaseModel):
    speaker: str
    text: str
    timestamp: Optional[float]


class CallDetailResponse(CallResponse):
    transcript: List[TranscriptSegmentResponse]


class CallListResponse(BaseModel):
    calls: List[CallResponse]
    total: int
