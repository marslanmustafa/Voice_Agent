"""
VoiceAgent — Centralized Vapi HTTP Client
Singleton async client with connection pooling, logging, and error mapping.
"""

import logging

import httpx

from app.core.config import settings
from app.utils.exceptions import VapiError

logger = logging.getLogger(__name__)

VAPI_BASE = "https://api.vapi.ai"

# Explicit per-phase timeouts.
# Vapi's outbound /call endpoint is slow to TCP-connect from some regions.
# connect=15s  — TCP handshake (was hitting ConnectTimeout before)
# read=60s     — dial calls can take extra time to respond
# write=10s    — uploading the request body
# pool=5s      — waiting for an idle connection from the pool
_VAPI_TIMEOUT = httpx.Timeout(connect=15.0, read=60.0, write=10.0, pool=5.0)

# Module-level singleton client (lazy-initialized at first use)
_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=VAPI_BASE,
            headers={"Authorization": f"Bearer {settings.VAPI_API_KEY}"},
            timeout=_VAPI_TIMEOUT,
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

    try:
        resp = await client.request(method, path, **kwargs)
    except httpx.TimeoutException as exc:
        # Map any timeout phase (connect / read / write / pool) to a clean 504.
        # Without this the exception escapes vapi_request, bypasses VapiError
        # handlers in callers, and logs as an unexpected 500.
        phase = type(exc).__name__  # ConnectTimeout | ReadTimeout | WriteTimeout | PoolTimeout
        logger.error(f"[VAPI] {phase} on {method} {path}")
        raise VapiError(
            status_code=504,
            detail=f"Vapi API request timed out ({phase}). Please try again.",
        ) from exc
    except httpx.RequestError as exc:
        # Network-level errors (DNS, connection refused, etc.)
        logger.error(f"[VAPI] Network error on {method} {path}: {exc}")
        raise VapiError(
            status_code=502,
            detail=f"Could not reach Vapi API: {exc}",
        ) from exc

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