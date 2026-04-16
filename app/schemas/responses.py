"""
VoiceAgent — Standardized API Response Schemas
Unified response models for consistent API formatting.
"""

from typing import Any, Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Standard success response wrapper."""
    ok: bool = True
    data: T | None = None
    message: str | None = None


class ApiError(BaseModel):
    """Standard error response."""
    ok: bool = False
    error: str
    detail: str | None = None
    vapi_status: int | None = None