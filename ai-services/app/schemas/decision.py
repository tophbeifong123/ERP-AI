from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class PostType(str, Enum):
    PROMOTION = "promotion"
    PRODUCT_SHOWCASE = "product_showcase"
    BRAND_AWARENESS = "brand_awareness"
    EVENT = "event"


class ServiceInfo(BaseModel):
    id: str
    name: str
    description: str | None = None
    price_minor: int | None = None


class BusinessContext(BaseModel):
    business_id: str
    name: str
    industry: str | None = None
    description: str | None = None
    tone: str | None = None
    target_audience: str | None = None
    keywords: list[str] = []


class PostingConfig(BaseModel):
    posts_per_week_target: int = Field(ge=1, le=14, default=3)
    min_gap_days: int = Field(ge=0, le=7, default=1)


class RecentPostInfo(BaseModel):
    last_post_date: datetime | None = None
    posts_this_week: int = 0


class DecisionRequest(BaseModel):
    business: BusinessContext
    posting_config: PostingConfig
    recent_posts: RecentPostInfo
    services: list[ServiceInfo] = []
    current_time: datetime | None = None


class DecisionResponse(BaseModel):
    should_post: bool
    reason: str
    suggested_scheduled_at: datetime | None = None
    post_type: PostType | None = None
    featured_service_ids: list[str] = []
    caption_hint: str | None = None
