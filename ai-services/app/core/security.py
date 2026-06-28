"""Shared helpers for the async-callback contract with the backend.

- verify_internal_token: guards incoming requests (X-Internal-Token header).
- post_callback: sends the result back to the backend's callbackUrl.
"""
import logging

import httpx
from fastapi import Header, HTTPException

from app.core.config import settings

logger = logging.getLogger("ai-services")


def verify_internal_token(x_internal_token: str = Header(default="")) -> None:
    """FastAPI dependency: reject requests without the shared secret.

    If INTERNAL_TOKEN is unset (e.g. local dev), auth is skipped.
    """
    if not settings.INTERNAL_TOKEN:
        return
    if x_internal_token != settings.INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Internal-Token")


def post_callback(callback_url: str, payload: dict) -> None:
    """POST the result to the backend's callbackUrl. Runs in a background task.

    Never raises to the caller — failures are logged. The backend retries on
    its own schedule if it never receives the callback.
    """
    headers = {"Content-Type": "application/json"}
    if settings.INTERNAL_TOKEN:
        headers["X-Internal-Token"] = settings.INTERNAL_TOKEN

    try:
        with httpx.Client(timeout=30.0) as http:
            resp = http.post(callback_url, json=payload, headers=headers)
            resp.raise_for_status()
        logger.info("Callback delivered to %s", callback_url)
    except Exception as e:
        logger.error("Callback to %s failed: %s", callback_url, e)
