"""AI Media stub.

The full async-callback contract lives in docs/contracts/AI-MEDIA.md. For the
MVP we return a placeholder fileId synchronously so the backend's
media.processor.ts can mark the ai-job as succeeded. The actual placeholder
file is not registered in the backend's `files` table — posts will be
dispatched with text only (no media URL) until the real media service exists.
"""
from fastapi import APIRouter, Depends, status

from app.core.security import verify_internal_token
from app.schemas.media import MediaRequest

router = APIRouter()


# Placeholder fileId returned by the stub. Not registered in the backend's
# `files` table — dispatch-post.processor.ts only posts the caption text to
# Facebook, so a missing file is non-fatal for the pipeline.
PLACEHOLDER_FILE_ID = "00000000-0000-0000-0000-000000000001"


@router.post(
    "/generate",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_internal_token)],
)
async def generate_media(request: MediaRequest) -> dict:
    """Synchronous stub: returns a placeholder fileId for the given ai-job.

    Matches the contract expected by backend/src/modules/jobs/media.processor.ts
    which awaits `data.fileId` from the response.
    """
    return {
        "fileId": PLACEHOLDER_FILE_ID,
        "kind": "image" if request.type == "image" else "short_video",
        "stub": True,
    }
