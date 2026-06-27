from fastapi import APIRouter, HTTPException
from app.schemas.decision import DecisionRequest, DecisionResponse
from app.services.decision_service import decide

router = APIRouter()


@router.post("/decide", response_model=DecisionResponse)
async def decide_post(request: DecisionRequest):
    """AI Decision: should we post today? Pick time, type, and featured services."""
    try:
        return decide(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
