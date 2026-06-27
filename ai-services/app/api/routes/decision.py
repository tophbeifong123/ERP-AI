from fastapi import APIRouter

router = APIRouter()


@router.post("/decide")
async def decide_post():
    """AI Decision: should we post today? Pick time, type, and featured services."""
    # TODO: implement decision logic
    return {"shouldPost": False, "reason": "not implemented yet"}
