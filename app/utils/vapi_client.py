"""
VoiceAgent — Centralized Vapi HTTP Client
Singleton async client with connection pooling, logging, and error mapping.
"""

import logging
from typing import Any

import httpx

from app.core.config import settings
from app.utils.exceptions import VapiError

logger = logging.getLogger(__name__)

VAPI_BASE = "https://api.vapi.ai"

# Module-level singleton client (lazy-initialized at first use)
_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=VAPI_BASE,
            headers={"Authorization": f"Bearer {settings.VAPI_API_KEY}"},
            timeout=30,
        )
    return _client


def clean_payload(data: dict) -> dict:
    """Remove empty/null/empty-collection values before sending to Vapi."""
    return {
        k: v for k, v in data.items()
        if v not in ("", None, [], {})
    }


async def vapi_request(method: str, path: str, **kwargs) -> dict:
    """Make an authenticated request to Vapi, returning JSON or raising VapiError."""
    client = _get_client()

    # Clean payload before sending
    if "json" in kwargs:
        kwargs["json"] = clean_payload(kwargs["json"])

    logger.info(f"[VAPI] {method} {path}")
    resp = await client.request(method, path, **kwargs)

    if resp.status_code >= 400:
        logger.error(f"[VAPI] Error {resp.status_code}: {resp.text}")
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        raise VapiError(status_code=resp.status_code, detail=detail)

    logger.info(f"[VAPI] {method} {path} → {resp.status_code}")
    return resp.json()


async def vapi_get(path: str, **kwargs) -> dict:
    return await vapi_request("GET", path, **kwargs)


async def vapi_post(path: str, **kwargs) -> dict:
    return await vapi_request("POST", path, **kwargs)


async def vapi_patch(path: str, **kwargs) -> dict:
    return await vapi_request("PATCH", path, **kwargs)


async def vapi_delete(path: str, **kwargs) -> dict:
    return await vapi_request("DELETE", path, **kwargs)