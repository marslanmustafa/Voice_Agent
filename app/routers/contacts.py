"""
VoiceAgent — Contacts Router
GET    /contacts          — list with pagination + search
POST   /contacts          — create single contact
GET    /contacts/{id}     — get one
PUT    /contacts/{id}     — update
DELETE /contacts/{id}     — delete
POST   /contacts/csv/upload — bulk import
GET    /contacts/csv/template — download template
"""

import csv
import io
import uuid
from typing import List, Optional

import phonenumbers
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import SYSTEM_USER_ID, get_current_user
from app.db.database import get_db
from app.db.models import Contact, User
from app.schemas.contacts import (
    ContactCreate, ContactListResponse, ContactResponse,
    ContactUpdate, CsvImportResponse,
)

router = APIRouter(prefix="/contacts", tags=["contacts"])


def normalize_phone(raw: str) -> str:
    """Normalize phone to E.164. Handles Pakistani local format (03xxxxxxxxx)."""
    import re
    digits = re.sub(r"[^\d+]", "", raw)
    # Pakistani numbers: 03xxxxxxxxx → +923xxxxxxxxx
    if re.match(r"^03\d{9}$", digits):
        digits = "+92" + digits[1:]
    elif re.match(r"^3\d{9}$", digits):
        digits = "+92" + digits
    try:
        parsed = phonenumbers.parse(digits, None)
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except phonenumbers.phonenumberutil.NumberParseException:
        pass
    return digits if digits.startswith("+") else f"+{digits}"


def _to_response(c: Contact) -> ContactResponse:
    return ContactResponse(
        id=str(c.id),
        name=c.name,
        phone=c.phone,
        email=c.email,
        tag=c.tag,
        notes=c.notes,
        created_at=c.created_at.isoformat() if c.created_at else "",
    )


@router.get("", response_model=ContactListResponse)
async def list_contacts(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    search: Optional[str] = None,
    tag: Optional[str] = None,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base_q = select(Contact).where(Contact.user_id == SYSTEM_USER_ID)
    if search:
        base_q = base_q.where(
            Contact.name.ilike(f"%{search}%") | Contact.phone.ilike(f"%{search}%")
        )
    if tag:
        base_q = base_q.where(Contact.tag == tag)

    total = await db.scalar(select(func.count()).select_from(base_q.subquery()))
    contacts = (
        await db.scalars(
            base_q.order_by(Contact.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()

    return ContactListResponse(
        contacts=[_to_response(c) for c in contacts],
        total=total or 0,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=ContactResponse, status_code=201)
async def create_contact(
    body: ContactCreate,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    phone = normalize_phone(body.phone)
    existing = await db.scalar(
        select(Contact).where(Contact.user_id == SYSTEM_USER_ID, Contact.phone == phone)
    )
    if existing:
        raise HTTPException(status_code=409, detail="Contact with this phone already exists")

    contact = Contact(user_id=SYSTEM_USER_ID, name=body.name, phone=phone,
                      email=body.email, tag=body.tag, notes=body.notes)
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return _to_response(contact)


@router.get("/csv/template")
async def download_template(_: User = Depends(get_current_user)):
    """Return a sample CSV template."""
    data = "name,phone,email,tag,notes\nJohn Doe,+12345678901,john@example.com,Lead,Follow up\nJane Smith,+923001234567,jane@example.com,Customer,Appointment\n"
    return StreamingResponse(
        io.StringIO(data),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contacts_template.csv"},
    )


@router.post("/csv/upload", response_model=CsvImportResponse)
async def upload_csv(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # handle BOM
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    imported = skipped = 0
    errors: List[str] = []

    for i, row in enumerate(reader, start=2):
        try:
            name = (row.get("name") or "").strip()
            phone_raw = (row.get("phone") or "").strip()
            if not name or not phone_raw:
                errors.append(f"Row {i}: name and phone are required")
                skipped += 1
                continue

            phone = normalize_phone(phone_raw)
            existing = await db.scalar(
                select(Contact).where(Contact.user_id == SYSTEM_USER_ID, Contact.phone == phone)
            )
            if existing:
                skipped += 1
                continue

            db.add(Contact(
                user_id=SYSTEM_USER_ID, name=name, phone=phone,
                email=(row.get("email") or "").strip() or None,
                tag=(row.get("tag") or "").strip() or None,
                notes=(row.get("notes") or "").strip() or None,
            ))
            imported += 1
        except Exception as exc:
            errors.append(f"Row {i}: {exc}")
            skipped += 1

    await db.commit()
    return CsvImportResponse(imported=imported, skipped=skipped, errors=errors)


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: str,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await db.scalar(
        select(Contact).where(Contact.id == uuid.UUID(contact_id), Contact.user_id == SYSTEM_USER_ID)
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return _to_response(contact)


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: str,
    body: ContactUpdate,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await db.scalar(
        select(Contact).where(Contact.id == uuid.UUID(contact_id), Contact.user_id == SYSTEM_USER_ID)
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    update_data = body.model_dump(exclude_unset=True)
    if "phone" in update_data:
        update_data["phone"] = normalize_phone(update_data["phone"])
    for k, v in update_data.items():
        setattr(contact, k, v)

    await db.commit()
    await db.refresh(contact)
    return _to_response(contact)


@router.delete("/{contact_id}", status_code=204)
async def delete_contact(
    contact_id: str,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await db.scalar(
        select(Contact).where(Contact.id == uuid.UUID(contact_id), Contact.user_id == SYSTEM_USER_ID)
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await db.delete(contact)
    await db.commit()
