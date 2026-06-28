from fastapi import APIRouter, HTTPException
from app.schemas.caption import CaptionRequest, CaptionResponse
from app.services.caption_service import generate_caption

router = APIRouter()


@router.post("/generate", response_model=CaptionResponse)
async def generate_post_caption(request: CaptionRequest):
    """AI Caption: generate a Thai-language caption and trigger the AI Media service."""
    try:
        return generate_caption(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
