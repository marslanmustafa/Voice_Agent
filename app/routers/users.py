"""
VoiceAgent — Users Router (Auth-Free, Env-driven config)
GET /users/config  — returns configuration from environment variables
PUT /users/config  — no-op kept for frontend compatibility
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.models import User

router = APIRouter(prefix="/users", tags=["users"])


class ConfigResponse(BaseModel):
    vapi_assistant_id: Optional[str] = None
    max_call_duration: int = 300
    retry_count: int = 1


@router.get("/config", response_model=ConfigResponse)
async def get_config(_: User = Depends(get_current_user)):
    """Return system-wide configuration from env vars."""
    return ConfigResponse(
        vapi_assistant_id=settings.VAPI_ASSISTANT_ID or None,
        max_call_duration=settings.VAPI_MAX_CALL_DURATION,
        retry_count=settings.VAPI_RETRY_COUNT,
    )


@router.put("/config", response_model=ConfigResponse)
async def update_config(_: User = Depends(get_current_user)):
    """No-op — config is now managed via environment variables."""
    return ConfigResponse(
        vapi_assistant_id=settings.VAPI_ASSISTANT_ID or None,
        max_call_duration=settings.VAPI_MAX_CALL_DURATION,
        retry_count=settings.VAPI_RETRY_COUNT,
    )
