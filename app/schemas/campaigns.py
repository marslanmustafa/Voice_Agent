"""
VoiceAgent — Campaign & Call Schemas
"""
from typing import List, Optional
from pydantic import BaseModel


# ── Campaigns ──────────────────────────────────────────────────────────────────

class AssistantOverrides(BaseModel):
    # This can be arbitrarily complex according to Vapi, we use dict for flexibility
    pass

class CreateCustomerDTO(BaseModel):
    number: Optional[str] = None
    sipUri: Optional[str] = None
    extension: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    externalId: Optional[str] = None
    numberE164CheckEnabled: Optional[bool] = None
    assistantOverrides: Optional[dict] = None

class CreateCampaignDTO(BaseModel):
    name: str
    assistantId: Optional[str] = None
    workflowId: Optional[str] = None
    squadId: Optional[str] = None
    phoneNumberId: str  # Required per Vapi documentation
    dialPlan: Optional[List[dict]] = None
    schedulePlan: Optional[dict] = None
    customers: Optional[List[CreateCustomerDTO]] = None

class CampaignResponse(BaseModel):
    id: str
    name: str
    status: str = "draft"
    created_at: str
    callsCounterScheduled: Optional[int] = 0
    callsCounterQueued: Optional[int] = 0
    callsCounterInProgress: Optional[int] = 0
    callsCounterEndedVoicemail: Optional[int] = 0
    callsCounterEnded: Optional[int] = 0

class CampaignListResponse(BaseModel):
    campaigns: List[CampaignResponse]
    total: int

class UpdateCampaignDTO(BaseModel):
    name: Optional[str] = None
    assistantId: Optional[str] = None
    phoneNumberId: Optional[str] = None
    workflowId: Optional[str] = None
    squadId: Optional[str] = None
    status: Optional[str] = None  # Vapi may support status updates


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
    cost: Optional[float] = 0.0
    ended_reason: Optional[str] = None
    created_at: str


class TranscriptSegmentResponse(BaseModel):
    speaker: str
    role: str
    text: str
    timestamp: Optional[float]
    time: Optional[int] = None


class CallDetailResponse(CallResponse):
    transcript: List[TranscriptSegmentResponse]


class CallListResponse(BaseModel):
    calls: List[CallResponse]
    total: int
