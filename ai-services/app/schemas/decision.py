"""Schemas for the AI Decision (time recommender) service.

Contract (simplified from the original `shouldPost` model):
- Input:  business profile + draft post context (hint, type, services)
- Output: a single `suggested_scheduled_at` timestamp + reasoning.
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
    price_minor: int | None = None
    currency: str | None = None
    is_active: bool = True


class BusinessContext(CamelModel):
    id: str
    name: str
    industry: str | None = None
    tone: str | None = None
    keywords: list[str] = []
    target_audience: str | None = None


# ---- Incoming request (backend -> AI) ----

class DecisionRequest(CamelModel):
    callback_url: str
    job_id: str
    post_id: str
    business: BusinessContext
    post_type: PostType | None = None
    featured_services: list[ServiceInfo] = []
    caption_hint: str | None = None
    now_iso: datetime | None = None


# ---- Outgoing callback (AI -> backend callbackUrl) ----

class DecisionResult(CamelModel):
    suggested_scheduled_at: datetime
    reasoning: str | None = None


class DecisionCallback(CamelModel):
    job_id: str
    result: DecisionResult


class ErrorInfo(CamelModel):
    code: str
    message: str


class DecisionErrorCallback(CamelModel):
    job_id: str
    error: ErrorInfo
