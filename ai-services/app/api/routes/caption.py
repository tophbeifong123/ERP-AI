from fastapi import APIRouter, BackgroundTasks, Depends, status

from app.core.security import verify_internal_token
from app.schemas.caption import CaptionRequest
from app.services.caption_service import process_caption

router = APIRouter()


@router.post("/generate", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(verify_internal_token)])
async def generate_post_caption(request: CaptionRequest, background_tasks: BackgroundTasks):
    """AI Caption (async): accept the job, then POST the caption to callbackUrl."""
    background_tasks.add_task(process_caption, request)
    return {"status": "accepted", "jobId": request.job_id}
