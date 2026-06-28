"""Tests for the AI Media stub.

The stub returns a placeholder fileId synchronously. We verify:
- a valid request returns a fileId matching the placeholder
- the type field drives the kind in the response
"""
from fastapi.testclient import TestClient

from app.main import app
from app.api.routes.media import PLACEHOLDER_FILE_ID

client = TestClient(app)


def test_media_generate_returns_placeholder_file_id():
    res = client.post(
        "/api/ai/media/generate",
        headers={"X-Internal-Token": "dev-internal-api-key"},
        json={
            "callbackUrl": "http://localhost:3000/internal/ai/image/callback",
            "jobId": "job-1",
            "postId": "post-1",
            "type": "image",
            "postType": "promotion",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["fileId"] == PLACEHOLDER_FILE_ID
    assert body["kind"] == "image"
    assert body["stub"] is True


def test_media_generate_short_video_kind():
    res = client.post(
        "/api/ai/media/generate",
        headers={"X-Internal-Token": "dev-internal-api-key"},
        json={
            "callbackUrl": "http://localhost:3000/internal/ai/short_video/callback",
            "jobId": "job-2",
            "postId": "post-2",
            "type": "short_video",
            "postType": "product_showcase",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["fileId"] == PLACEHOLDER_FILE_ID
    assert body["kind"] == "short_video"

