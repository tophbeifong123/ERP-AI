"""Schemas for the AI Caption service.

Matches docs/contracts/AI-CAPTION.md for the request/callback envelope. The
result also carries a `mediaRequest` object whose CONTENTS are in the AI Media
tool's own snake_case format (content_type, aspect_ratio, scenes, ...), so the
backend can forward it to AI Media as-is.
"""
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import CamelModel
from app.schemas.decision import PostType, BusinessContext, ErrorInfo

MediaType = Literal["image", "short_video"]


# Caption's featured-service shape differs from Decision's: here the price
# field is `price` (not `priceMinor`), per docs/contracts/AI-CAPTION.md.
class FeaturedService(CamelModel):
    id: str
    name: str
    description: str | None = None
    price: int | None = None          # satang (6000 = 60.00 THB)
    currency: str | None = None


# ---- Incoming request (backend -> AI) ----

class CaptionRequest(CamelModel):
    callback_url: str
    job_id: str
    post_id: str
    business: BusinessContext
    post_type: PostType
    featured_services: list[FeaturedService] = []
    caption_hint: str | None = None
    target_audience: str | None = None
    # Backend tells us which media to request. Defaults to image.
    media_type: MediaType = "image"


# ---- AI Media payload (snake_case = the AI Media tool's own format) ----
# Kept as plain BaseModel so it serializes snake_case, not camelCase.

class Scene(BaseModel):
    prompt: str


class MediaRequest(BaseModel):
    content_type: MediaType
    aspect_ratio: str
    style: str
    negative_prompt: str
    # Top-level `prompt` (first scene). The AI Media image branch reads this,
    # while the video branch reads `scenes[]`. We send both for compatibility.
    prompt: str
    scenes: list[Scene]
    metadata: dict
    # `callback_url` is intentionally omitted — the backend fills it in before
    # forwarding to AI Media (it owns the media webhook URL).


# ---- Outgoing callback (AI -> backend callbackUrl) ----

class CaptionResult(CamelModel):
    caption: str
    # Structured request for AI Media (image or sequential-scene short video),
    # in English. Supersedes the earlier single mediaPrompt string.
    media_request: MediaRequest | None = None


class CaptionCallback(CamelModel):
    job_id: str
    result: CaptionResult


class CaptionErrorCallback(CamelModel):
    job_id: str
    error: ErrorInfo
