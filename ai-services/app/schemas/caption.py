"""Schemas for the AI Caption service.

Matches docs/contracts/AI-CAPTION.md. The success callback returns ONLY the
caption text (hashtags are embedded inside it); recommended 100-500 chars,
hard limit 2000.
"""
from app.schemas.common import CamelModel
from app.schemas.decision import PostType, BusinessContext, ErrorInfo


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


# ---- Outgoing callback (AI -> backend callbackUrl) ----

class CaptionResult(CamelModel):
    caption: str


class CaptionCallback(CamelModel):
    job_id: str
    result: CaptionResult


class CaptionErrorCallback(CamelModel):
    job_id: str
    error: ErrorInfo
