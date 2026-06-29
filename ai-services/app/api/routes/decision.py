from fastapi import APIRouter, BackgroundTasks, Depends, status

from app.core.security import verify_internal_token
from app.schemas.decision import DecisionRequest
from app.services.decision_service import process_decision

router = APIRouter()


@router.post(
    "/recommend-time",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(verify_internal_token)],
)
async def recommend_post_time(
    request: DecisionRequest, background_tasks: BackgroundTasks
):
    """AI Time Recommender (async): accept the job, POST the suggestion to callbackUrl."""
    background_tasks.add_task(process_decision, request)
    return {"status": "accepted", "jobId": request.job_id}
