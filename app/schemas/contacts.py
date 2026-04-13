"""
VoiceAgent — Contact Schemas
"""
from typing import List, Optional
from pydantic import BaseModel


class ContactCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    tag: Optional[str] = None
    notes: Optional[str] = None


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tag: Optional[str] = None
    notes: Optional[str] = None


class ContactResponse(BaseModel):
    id: str
    name: str
    phone: str
    email: Optional[str]
    tag: Optional[str]
    notes: Optional[str]
    created_at: str


class ContactListResponse(BaseModel):
    contacts: List[ContactResponse]
    total: int
    page: int
    page_size: int


class CsvImportResponse(BaseModel):
    imported: int
    skipped: int
    errors: List[str]
