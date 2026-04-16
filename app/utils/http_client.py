import httpx
from fastapi import HTTPException


def clean_payload(data: dict) -> dict:
    return {
        k: v for k, v in data.items()
        if v not in ("", None, [], {})
    }


def handle_response(resp: httpx.Response):
    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text

        raise HTTPException(
            status_code=resp.status_code,
            detail=detail
        )

    return resp.json()


async def post(url: str, payload: dict, headers: dict):
    payload = clean_payload(payload)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)

    return handle_response(resp)