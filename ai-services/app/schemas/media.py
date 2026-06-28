"""Schemas for the AI Media service stub.

Minimal MVP: receives a request from the backend's media.processor.ts and
returns a placeholder fileId synchronously (matching the existing
media.processor.ts pattern, which reads `data.fileId` from the immediate
response rather than relying on a callback).

The full async-callback contract is documented in docs/contracts/AI-MEDIA.md
but is not implemented in this stub.
"""
from app.schemas.common import CamelModel


class MediaRequest(CamelModel):
    callback_url: str
    job_id: str
    post_id: str
    type: str  # 'image' or 'short_video'
    post_type: str | None = None
