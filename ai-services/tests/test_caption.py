"""Tests for the AI Caption service (async-callback contract).

Groq and the callback are mocked, so no real API/network calls happen.
"""
import json

from app.schemas.caption import CaptionRequest, FeaturedService
from app.schemas.decision import BusinessContext, PostType
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
        featured_services=[FeaturedService(id="svc-1", name="ลาเต้", price=6500, currency="THB")],
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


def test_image_media_request_single_scene(monkeypatch):
    """media_type=image -> content_type image, 5:4, exactly 1 scene."""
    fake = json.dumps({
        "caption": "อร่อยมาก! #อาหาร",
        "scenes": ["A photorealistic bowl of Thai tom yum, fresh shrimp, warm light, no text"],
    })
    monkeypatch.setattr(caption_service.client.chat.completions, "create", _fake_groq(fake))

    result = caption_service.build_caption(_request(media_type="image"))
    mr = result.media_request
    assert mr.content_type == "image"
    assert mr.aspect_ratio == "4:5"
    assert len(mr.scenes) == 1
    assert mr.scenes[0].prompt.startswith("A photorealistic")
    # top-level prompt (read by the AI Media image branch) mirrors the scene
    assert mr.prompt == mr.scenes[0].prompt
    assert mr.negative_prompt == caption_service.NEGATIVE_PROMPT
    assert mr.master_prompt is None   # images don't use a master prompt


def test_video_media_request_four_scenes(monkeypatch):
    """media_type=short_video -> content_type short_video, 9:16, 4 scenes + master_prompt."""
    fake = json.dumps({
        "caption": "ดูคลิป! #โปร",
        "masterPrompt": "A cinematic 4-scene vertical video of a cozy coffee ritual, warm tone",
        "scenes": [f"English scene {i}" for i in range(1, 7)],  # model over-produces 6
    })
    monkeypatch.setattr(caption_service.client.chat.completions, "create", _fake_groq(fake))

    result = caption_service.build_caption(_request(media_type="short_video"))
    mr = result.media_request
    assert mr.content_type == "short_video"
    assert mr.aspect_ratio == "9:16"
    assert len(mr.scenes) == caption_service.VIDEO_SCENE_COUNT  # capped to 4
    assert mr.master_prompt.startswith("A cinematic 4-scene")   # video overview captured


def test_uses_ai_chosen_style(monkeypatch):
    """When the model returns a style, it is used in the media request."""
    fake = json.dumps({
        "caption": "อร่อย! #อาหาร",
        "style": "cinematic food commercial",
        "scenes": ["A close-up of steaming noodles, warm light, no text"],
    })
    monkeypatch.setattr(caption_service.client.chat.completions, "create", _fake_groq(fake))

    result = caption_service.build_caption(_request(media_type="image"))
    assert result.media_request.style == "cinematic food commercial"


def test_style_falls_back_to_default(monkeypatch):
    """If the model omits style, fall back to DEFAULT_STYLE."""
    fake = json.dumps({"caption": "hi", "scenes": ["A bowl of noodles, warm light, no text"]})
    monkeypatch.setattr(caption_service.client.chat.completions, "create", _fake_groq(fake))

    result = caption_service.build_caption(_request(media_type="image"))
    assert result.media_request.style == caption_service.DEFAULT_STYLE


def test_media_request_absent_when_no_scenes(monkeypatch):
    """If the model omits scenes, we still succeed with media_request None."""
    monkeypatch.setattr(caption_service.client.chat.completions, "create",
                        _fake_groq(json.dumps({"caption": "hi"})))
    result = caption_service.build_caption(_request())
    assert result.media_request is None


def test_process_caption_callback_has_snakecase_media_request(monkeypatch):
    """Envelope is camelCase; the mediaRequest CONTENTS stay snake_case for AI Media."""
    captured = {}
    monkeypatch.setattr(caption_service, "post_callback",
                        lambda url, payload: captured.update(url=url, payload=payload))
    monkeypatch.setattr(caption_service.client.chat.completions, "create",
                        _fake_groq(json.dumps({"caption": "โพสต์ทดสอบ #ทดสอบ",
                                               "scenes": ["A cozy cafe scene, no text"]})))

    caption_service.process_caption(_request(media_type="image"))

    result = captured["payload"]["result"]
    assert captured["payload"]["jobId"] == "job-123"
    assert result["caption"] == "โพสต์ทดสอบ #ทดสอบ"
    mr = result["mediaRequest"]            # camelCase envelope key
    assert mr["content_type"] == "image"   # snake_case AI Media contents
    assert mr["prompt"] == "A cozy cafe scene, no text"          # image branch field
    assert mr["scenes"][0]["prompt"] == "A cozy cafe scene, no text"
    assert mr["metadata"]["campaign_id"] == "post-123"


def test_llm_failure_falls_back_to_template_caption(monkeypatch):
    """If the LLM call fails, build_caption returns a template caption (no media
    request) instead of raising, so the callback is a success with that caption."""
    captured = {}
    monkeypatch.setattr(caption_service, "post_callback",
                        lambda url, payload: captured.update(payload=payload))

    def boom(*args, **kwargs):
        raise RuntimeError("model down")

    monkeypatch.setattr(caption_service.client.chat.completions, "create", boom)

    caption_service.process_caption(_request(caption_hint="ซื้อ 1 แถม 1"))

    payload = captured["payload"]
    assert payload["jobId"] == "job-123"
    assert "error" not in payload                      # fallback => success, not error
    result = payload["result"]
    assert "ซื้อ 1 แถม 1" in result["caption"]          # hint is woven into the fallback
    assert result.get("mediaRequest") is None          # no media on the fallback path
