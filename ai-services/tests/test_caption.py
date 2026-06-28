"""Tests for the AI Caption service (async-callback contract).

Groq and the callback are mocked, so no real API/network calls happen.
"""
import json

from app.schemas.caption import CaptionRequest
from app.schemas.decision import BusinessContext, ServiceInfo, PostType
from app.services import caption_service


def _fake_groq(fake_json: str):
    def fake_create(*args, **kwargs):
        class _Msg:
            content = fake_json

        class _Choice:
            message = _Msg()

        class _Resp:
            choices = [_Choice()]

        return _Resp()

    return fake_create


def _request(**overrides) -> CaptionRequest:
    data = dict(
        callback_url="https://api.example.com/internal/ai/caption/callback",
        job_id="job-123",
        post_id="post-123",
        business=BusinessContext(id="b1", name="ร้านกาแฟ", tone="เป็นกันเอง"),
        post_type=PostType.PROMOTION,
        featured_services=[ServiceInfo(id="svc-1", name="ลาเต้", price=6500, currency="THB")],
        caption_hint="ซื้อ 1 แถม 1",
        target_audience="คนรุ่นใหม่",
    )
    data.update(overrides)
    return CaptionRequest(**data)


def test_request_accepts_camelcase_input():
    req = CaptionRequest.model_validate({
        "callbackUrl": "https://x/cb",
        "jobId": "j1",
        "postId": "p1",
        "business": {"id": "b1", "name": "Shop"},
        "postType": "promotion",
        "featuredServices": [{"id": "s1", "name": "Item", "price": 6000, "currency": "THB"}],
        "targetAudience": "office workers",
    })
    assert req.job_id == "j1"
    assert req.featured_services[0].price == 6000


def test_build_caption_parses_and_truncates(monkeypatch):
    long_caption = "ก" * 2500
    monkeypatch.setattr(caption_service.client.chat.completions, "create",
                        _fake_groq(json.dumps({"caption": long_caption})))

    result = caption_service.build_caption(_request())
    assert len(result.caption) == caption_service.MAX_CAPTION_CHARS  # hard limit enforced


def test_strips_code_fences(monkeypatch):
    fenced = "```json\n" + json.dumps({"caption": "สวัสดี 🍵 #กาแฟ"}) + "\n```"
    monkeypatch.setattr(caption_service.client.chat.completions, "create", _fake_groq(fenced))
    result = caption_service.build_caption(_request())
    assert result.caption == "สวัสดี 🍵 #กาแฟ"


def test_process_caption_posts_camelcase_callback(monkeypatch):
    captured = {}
    monkeypatch.setattr(caption_service, "post_callback",
                        lambda url, payload: captured.update(url=url, payload=payload))
    monkeypatch.setattr(caption_service.client.chat.completions, "create",
                        _fake_groq(json.dumps({"caption": "โพสต์ทดสอบ #ทดสอบ"})))

    caption_service.process_caption(_request())

    assert captured["payload"]["jobId"] == "job-123"
    assert captured["payload"]["result"]["caption"] == "โพสต์ทดสอบ #ทดสอบ"


def test_process_caption_sends_error_callback_on_failure(monkeypatch):
    captured = {}
    monkeypatch.setattr(caption_service, "post_callback",
                        lambda url, payload: captured.update(payload=payload))

    def boom(*args, **kwargs):
        raise RuntimeError("model down")

    monkeypatch.setattr(caption_service.client.chat.completions, "create", boom)

    caption_service.process_caption(_request())

    assert captured["payload"]["jobId"] == "job-123"
    assert captured["payload"]["error"]["code"] == "model_error"
