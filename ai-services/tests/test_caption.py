"""Tests for the AI Caption service.

Groq is mocked so no real API call is made. We verify:
  - the JSON response is parsed into caption / hashtags / CTA
  - the AI Media trigger can be turned off (trigger_media=False)
  - the AI Media trigger is fault-tolerant (a network error never crashes us)
"""
import json

from app.schemas.caption import CaptionRequest
from app.schemas.decision import BusinessContext, ServiceInfo, PostType
from app.services import caption_service


def _fake_groq(fake_json: str):
    """Return a function that mimics the Groq SDK's create() response shape."""
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
        business=BusinessContext(business_id="b1", name="ร้านกาแฟ", tone="เป็นกันเอง"),
        post_type=PostType.PROMOTION,
        featured_services=[ServiceInfo(id="svc-1", name="ลาเต้", price_minor=6500)],
        caption_hint="ซื้อ 1 แถม 1",
        trigger_media=False,
    )
    data.update(overrides)
    return CaptionRequest(**data)


def test_parses_caption_fields(monkeypatch):
    """A well-formed AI reply maps onto the response fields."""
    fake = json.dumps({
        "caption": "วันนี้มีโปรพิเศษ! 🍵",
        "hashtags": ["#กาแฟ", "#โปรโมชั่น"],
        "call_to_action": "รีบมาก่อนของหมด!",
    })
    monkeypatch.setattr(caption_service.client.chat.completions, "create", _fake_groq(fake))

    resp = caption_service.generate_caption(_request(trigger_media=False))

    assert resp.caption == "วันนี้มีโปรพิเศษ! 🍵"
    assert resp.hashtags == ["#กาแฟ", "#โปรโมชั่น"]
    assert resp.call_to_action == "รีบมาก่อนของหมด!"
    assert resp.media_triggered is False  # we asked not to trigger


def test_strips_code_fences(monkeypatch):
    """The AI sometimes wraps JSON in ```json fences; we must strip them."""
    fenced = "```json\n" + json.dumps({"caption": "hi", "hashtags": []}) + "\n```"
    monkeypatch.setattr(caption_service.client.chat.completions, "create", _fake_groq(fenced))

    resp = caption_service.generate_caption(_request(trigger_media=False))
    assert resp.caption == "hi"


def test_media_trigger_is_fault_tolerant(monkeypatch):
    """If the AI Media service errors, caption still succeeds with media_triggered=False."""
    fake = json.dumps({"caption": "ok", "hashtags": []})
    monkeypatch.setattr(caption_service.client.chat.completions, "create", _fake_groq(fake))

    # Force the media call to blow up; the service must swallow it.
    def boom(*args, **kwargs):
        raise ConnectionError("media service down")

    monkeypatch.setattr(caption_service.httpx, "Client", boom)

    resp = caption_service.generate_caption(_request(trigger_media=True))

    assert resp.caption == "ok"           # caption still produced
    assert resp.media_triggered is False  # but media reported as failed
    assert "unavailable" in resp.media_status.lower()
