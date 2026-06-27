from fastapi import APIRouter

router = APIRouter()


@router.post("/generate")
async def generate_caption():
    """AI Caption: generate Thai-language caption and trigger AI Media service."""
    # TODO: implement caption generation
    return {"caption": "", "status": "not implemented yet"}
