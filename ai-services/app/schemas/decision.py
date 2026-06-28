"""Schemas for the AI Decision service.

Matches docs/contracts/AI-DECISION.md on the backend `backend` branch.
Note: `services` is added per the backend dev's decision to send the
catalogue in the request (Option 1). Confirm exact item fields with them.
"""
from datetime import datetime
from enum import Enum

from pydantic import Field

from app.schemas.common import CamelModel


class PostType(str, Enum):
    PROMOTION = "promotion"
    PRODUCT_SHOWCASE = "product_showcase"
    BRAND_AWARENESS = "brand_awareness"
    EVENT = "event"


class ServiceInfo(CamelModel):
    id: str
    name: str
    description: str | None = None
    price_minor: int | None = None    # -> priceMinor; satang (6000 = 60.00 THB)
    currency: str | None = None
    is_active: bool = True


class BusinessContext(CamelModel):
    id: str
    name: str
    industry: str | None = None
    description: str | None = None
    tone: str | None = None
    keywords: list[str] = []
    target_audience: str | None = None
    posts_per_week_target: int = Field(ge=1, le=14, default=3)
    min_gap_days: int = Field(ge=0, le=7, default=1)
    logo_public_url: str | None = None


class RecentPost(CamelModel):
    posted_at: datetime
    post_type: str


# ---- Incoming request (backend -> AI) ----

class DecisionRequest(CamelModel):
    callback_url: str
    plan_id: str
    business: BusinessContext
    recent_posts: list[RecentPost] = []
    posts_this_week: int = 0
    last_post_at: datetime | None = None
    now_iso: datetime | None = None
    services: list[ServiceInfo] = []
    # Service IDs featured in recent posts -> lets the AI avoid repeating them.
    recent_featured_service_ids: list[str] = []


# ---- Outgoing callback (AI -> backend callbackUrl) ----

class Decision(CamelModel):
    should_post: bool
    reasoning: str
    suggested_scheduled_at: datetime | None = None
    post_type: PostType | None = None
    featured_service_ids: list[str] = []
    caption_hint: str | None = None


class DecisionCallback(CamelModel):
    plan_id: str
    decision: Decision


class ErrorInfo(CamelModel):
    code: str
    message: str


class DecisionErrorCallback(CamelModel):
    plan_id: str
    error: ErrorInfo
