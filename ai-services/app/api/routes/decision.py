from fastapi import APIRouter, BackgroundTasks, Depends, status

from app.core.security import verify_internal_token
from app.schemas.decision import DecisionRequest
from app.services.decision_service import process_decision

router = APIRouter()


@router.post("/decide", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(verify_internal_token)])
async def decide_post(request: DecisionRequest, background_tasks: BackgroundTasks):
    """AI Decision (async): accept the job, then POST the decision to callbackUrl."""
    background_tasks.add_task(process_decision, request)
    return {"status": "accepted", "planId": request.plan_id}
