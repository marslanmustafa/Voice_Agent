"""
VoiceAgent — Vapi Service
Thin async client for Vapi REST API.
"""

import httpx

from app.core.config import settings

VAPI_BASE = "https://api.vapi.ai"


def _headers() -> dict:
    return {"Authorization": f"Bearer {settings.VAPI_API_KEY}"}

async def get_assistant(assistant_id: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{VAPI_BASE}/assistant/{assistant_id}", headers=_headers())
    resp.raise_for_status()
    return resp.json()


async def create_outbound_call(
    assistant_id: str,
    customer_number: str,
    phone_number_id: str | None = None,
    first_message: str | None = None,
    system_prompt: str | None = None,
) -> dict:
    payload: dict = {
        "assistantId": assistant_id,
        "customer": {"number": customer_number},
    }
    
    if phone_number_id:
        payload["phoneNumberId"] = phone_number_id
    elif settings.TWILIO_PHONE_NUMBER and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
        # Fallback to providing explicit Twilio credentials if the assistant doesn't natively have a phone configured
        payload["phoneNumber"] = {
            "twilioPhoneNumber": settings.TWILIO_PHONE_NUMBER,
            "twilioAccountSid": settings.TWILIO_ACCOUNT_SID,
            "twilioAuthToken": settings.TWILIO_AUTH_TOKEN
        }
        
    overrides = {}
    if first_message:
        overrides["firstMessage"] = first_message

    if system_prompt:
        try:
            # We must fetch the existing assistant to preserve its provider and model name.
            # Vapi assistantOverrides replaces the entire `model` block, causing 400 Bad Request if provider is missing.
            assistant_data = await get_assistant(assistant_id)
            assistant_model = assistant_data.get("model", {})
            # Overwrite only the messages array
            assistant_model["messages"] = [{"role": "system", "content": system_prompt}]
            overrides["model"] = assistant_model
        except Exception as e:
            # Fallback if fetching fails, though it might trigger 400 if Vapi strictly validates
            overrides["model"] = {"provider": "openai", "model": "gpt-4", "messages": [{"role": "system", "content": system_prompt}]}
            
    # Enforce recording for all calls
    overrides["recordingEnabled"] = True
    # Vapi sometimes looks here too for audio artifact tracking
    overrides["artifactPlan"] = {"recordingEnabled": True}
        
    # Enable Call Monitoring to return listenUrl
    overrides["monitorPlan"] = {"listenEnabled": True}
        
    payload["assistantOverrides"] = overrides

    async with httpx.AsyncClient(timeout=30) as client:
        # standard Vapi endpoint for creating an outbound web or phone call
        resp = await client.post(f"{VAPI_BASE}/call/phone/outbound", json=payload, headers=_headers())
        if resp.status_code == 404:
            # Fallback if Vapi updated route structures
            resp = await client.post(f"{VAPI_BASE}/call/phone", json=payload, headers=_headers())
        if resp.status_code == 404:
            resp = await client.post(f"{VAPI_BASE}/call", json=payload, headers=_headers())

    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Vapi error {resp.status_code}: {resp.text}")
    return resp.json()


async def end_call(vapi_call_id: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f"{VAPI_BASE}/call/{vapi_call_id}/end", headers=_headers()
        )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Vapi error {resp.status_code}: {resp.text}")
    return resp.json()


async def get_call(vapi_call_id: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{VAPI_BASE}/call/{vapi_call_id}", headers=_headers())
    resp.raise_for_status()
    return resp.json()


async def list_calls(assistant_id: str, limit: int = 50) -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{VAPI_BASE}/call",
            params={"assistantId": assistant_id, "limit": limit},
            headers=_headers()
        )
    resp.raise_for_status()
    data = resp.json()
    # Vapi GET /call returns an array of call objects or an object with results
    if isinstance(data, list):
        return data
    elif isinstance(data, dict) and "results" in data:
        return data["results"]
    return []


async def get_call_transcript(vapi_call_id: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{VAPI_BASE}/call/{vapi_call_id}/transcripts", headers=_headers())
    if resp.status_code == 404:
        return []
    resp.raise_for_status()
    return resp.json()


async def create_campaign(name: str, assistant_id: str, phone_number_id: str | None = None) -> dict:
    payload = {"name": name, "assistantId": assistant_id}
    if phone_number_id:
        payload["phoneNumberId"] = phone_number_id
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{VAPI_BASE}/campaign", json=payload, headers=_headers())
    resp.raise_for_status()
    return resp.json()


async def add_campaign_contacts(vapi_campaign_id: str, contacts: list[dict]) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{VAPI_BASE}/campaign/{vapi_campaign_id}/contacts", json=contacts, headers=_headers())
    resp.raise_for_status()
    return resp.json()


async def start_campaign(vapi_campaign_id: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(f"{VAPI_BASE}/campaign/{vapi_campaign_id}/start", headers=_headers())
    resp.raise_for_status()
    return resp.json()


async def stop_campaign(vapi_campaign_id: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(f"{VAPI_BASE}/campaign/{vapi_campaign_id}/stop", headers=_headers())
    resp.raise_for_status()
    return resp.json()


async def get_campaign_stats(vapi_campaign_id: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{VAPI_BASE}/campaign/{vapi_campaign_id}", headers=_headers())
    resp.raise_for_status()
    return resp.json()


async def list_campaigns() -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{VAPI_BASE}/campaign", headers=_headers())
    resp.raise_for_status()
    return resp.json()
