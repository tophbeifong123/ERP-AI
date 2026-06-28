"""Schemas for the AI Caption service.

Matches docs/contracts/AI-CAPTION.md. The success callback returns ONLY the
caption text (hashtags are embedded inside it); recommended 100-500 chars,
hard limit 2000.
"""
from app.schemas.common import CamelModel
from app.schemas.decision import PostType, BusinessContext, ServiceInfo, ErrorInfo


# ---- Incoming request (backend -> AI) ----

class CaptionRequest(CamelModel):
    callback_url: str
    job_id: str
    post_id: str
    business: BusinessContext
    post_type: PostType
    featured_services: list[ServiceInfo] = []
    caption_hint: str | None = None
    target_audience: str | None = None


# ---- Outgoing callback (AI -> backend callbackUrl) ----

class CaptionResult(CamelModel):
    caption: str


class CaptionCallback(CamelModel):
    job_id: str
    result: CaptionResult


class CaptionErrorCallback(CamelModel):
    job_id: str
    error: ErrorInfo
