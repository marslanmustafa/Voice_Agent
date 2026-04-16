"""
VoiceAgent — Vapi Service
Thin async client for Vapi REST API.
Uses centralized vapi_client for all HTTP calls.
"""

import logging

from app.core.config import settings
from app.utils.vapi_client import vapi_get, vapi_post, vapi_patch

logger = logging.getLogger(__name__)

VAPI_BASE = "https://api.vapi.ai"


async def get_assistant(assistant_id: str) -> dict:
    return await vapi_get(f"/assistant/{assistant_id}")


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
        payload["phoneNumber"] = {
            "twilioPhoneNumber": settings.TWILIO_PHONE_NUMBER,
            "twilioAccountSid": settings.TWILIO_ACCOUNT_SID,
            "twilioAuthToken": settings.TWILIO_AUTH_TOKEN,
        }

    overrides = {}
    if first_message:
        overrides["firstMessage"] = first_message

    if system_prompt:
        try:
            assistant_data = await get_assistant(assistant_id)
            assistant_model = assistant_data.get("model", {})
            assistant_model["messages"] = [{"role": "system", "content": system_prompt}]
            overrides["model"] = assistant_model
        except Exception as e:
            logger.warning(f"[VAPI] Failed to fetch assistant for override: {e}")
            overrides["model"] = {"provider": "openai", "model": "gpt-4o", "messages": [{"role": "system", "content": system_prompt}]}

    overrides["recordingEnabled"] = True
    overrides["artifactPlan"] = {"recordingEnabled": True}
    overrides["monitorPlan"] = {"listenEnabled": True, "controlEnabled": True}

    payload["assistantOverrides"] = overrides

    # Try primary route, fall back to older routes on 404
    resp = await vapi_post("/call", json=payload)
    print("resp", resp)
    return resp


async def end_call(vapi_call_id: str) -> dict:
    return await vapi_post(f"/call/{vapi_call_id}/end")


async def get_call(vapi_call_id: str) -> dict:
    return await vapi_get(f"/call/{vapi_call_id}")


async def list_calls(assistant_id: str, limit: int = 50) -> list[dict]:
    data = await vapi_get("/call", params={"assistantId": assistant_id, "limit": limit})
    if isinstance(data, list):
        return data
    elif isinstance(data, dict) and "results" in data:
        return data["results"]
    return []


async def get_call_transcript(vapi_call_id: str) -> list[dict]:
    try:
        return await vapi_get(f"/call/{vapi_call_id}/transcripts")
    except Exception:
        return []


async def create_campaign(payload: dict) -> dict:
    logger.info(f"[VAPI] Creating campaign: {payload}")
    resp = await vapi_post("/campaign", json=payload)
    logger.info(f"[VAPI] Campaign created: {resp.get('id')}")
    return resp


async def add_campaign_contacts(vapi_campaign_id: str, contacts: list[dict]) -> dict:
    return await vapi_post(f"/campaign/{vapi_campaign_id}/contacts", json=contacts)


async def start_campaign(vapi_campaign_id: str) -> dict:
    return await vapi_post(f"/campaign/{vapi_campaign_id}/start")


async def stop_campaign(vapi_campaign_id: str) -> dict:
    return await vapi_post(f"/campaign/{vapi_campaign_id}/stop")


async def get_campaign(vapi_campaign_id: str) -> dict:
    return await vapi_get(f"/campaign/{vapi_campaign_id}")


async def update_campaign(vapi_campaign_id: str, payload: dict) -> dict:
    return await vapi_patch(f"/campaign/{vapi_campaign_id}", json=payload)


async def list_campaigns() -> list[dict]:
    return await vapi_get("/campaign")


async def list_phone_numbers() -> list[dict]:
    return await vapi_get("/phone-number")