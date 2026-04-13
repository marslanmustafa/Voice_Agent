"""
VoiceAgent — User & Config Schemas
"""
from typing import Optional
from pydantic import BaseModel


class UserMeResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    provider: str
    avatar_url: Optional[str]
    is_onboarded: bool = False


class UserConfigUpdate(BaseModel):
    max_call_duration: Optional[int] = None
    retry_count: Optional[int] = None
    vapi_assistant_id: Optional[str] = None


class UserConfigResponse(BaseModel):
    id: str
    max_call_duration: int
    retry_count: int
    vapi_assistant_id: Optional[str]
    updated_at: Optional[str]
