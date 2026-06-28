from pydantic import BaseModel, Field
from app.schemas.decision import PostType, BusinessContext, ServiceInfo


class CaptionRequest(BaseModel):
    business: BusinessContext
    post_type: PostType | None = None
    featured_services: list[ServiceInfo] = []
    caption_hint: str | None = None
    trigger_media: bool = True


class CaptionResponse(BaseModel):
    caption: str
    hashtags: list[str] = []
    call_to_action: str | None = None
    media_triggered: bool = False
    media_status: str | None = None
