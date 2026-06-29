"""Tests for the AI Time Recommender (decision) service.

The LLM is mocked, so no real network calls happen. The fallback path is
also tested by making the LLM raise.
"""
import json
from datetime import datetime, timezone

from app.schemas.decision import (
    BusinessContext,
    DecisionRequest,
    ServiceInfo,
)
from app.services import decision_service


def _request(**overrides) -> DecisionRequest:
    data = dict(
        callback_url="https://api.example.com/internal/ai/decision/callback",
        job_id="job-123",
        post_id="post-1",
        business=BusinessContext(
            id="b1", name="Test Shop", industry="ร้านกาแฟ", tone="friendly"
        ),
        post_type="promotion",
        featured_services=[
            ServiceInfo(id="svc-1", name="Latte", price_minor=6500, currency="THB")
        ],
        caption_hint="โปรโมชั่นลดราคา",
        now_iso=datetime(2026, 6, 28, 10, 0, tzinfo=timezone.utc),
    )
    data.update(overrides)
    return DecisionRequest(**data)


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


def test_request_accepts_camelcase_input():
    req = DecisionRequest.model_validate({
        "callbackUrl": "https://x/cb",
        "jobId": "j1",
        "postId": "p1",
        "business": {"id": "b1", "name": "Shop"},
        "postType": "promotion",
        "featuredServices": [
            {"id": "s1", "name": "Coffee", "priceMinor": 6500, "currency": "THB"}
        ],
        "captionHint": "โปรฯ",
        "nowIso": "2026-06-28T06:00:00Z",
    })
    assert req.job_id == "j1"
    assert req.featured_services[0].price_minor == 6500


def test_ai_path_returns_time_recommendation(monkeypatch):
    fake = json.dumps({
        "suggested_scheduled_at": "2026-06-28T18:00:00Z",
        "reasoning": "Peak engagement window for Thai working audience",
    })
    monkeypatch.setattr(
        decision_service.client.chat.completions, "create", _fake_groq(fake)
    )

    result = decision_service.build_decision(_request())
    assert result.suggested_scheduled_at == datetime(
        2026, 6, 28, 18, 0, tzinfo=timezone.utc
    )
    assert "engagement" in (result.reasoning or "").lower()


def test_falls_back_when_llm_returns_invalid(monkeypatch):
    bad = json.dumps({"reasoning": "I forgot the timestamp"})
    monkeypatch.setattr(
        decision_service.client.chat.completions, "create", _fake_groq(bad)
    )

    now = datetime(2026, 6, 28, 10, 0, tzinfo=timezone.utc)
    result = decision_service.build_decision(_request(now_iso=now))
    assert result.suggested_scheduled_at >= now


def test_falls_back_when_llm_raises(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("groq exploded")

    monkeypatch.setattr(decision_service.client.chat.completions, "create", boom)

    now = datetime(2026, 6, 28, 10, 0, tzinfo=timezone.utc)
    result = decision_service.build_decision(_request(now_iso=now))
    assert result.suggested_scheduled_at >= now
    assert "Fallback" in (result.reasoning or "")


def test_process_decision_posts_camelcase_callback(monkeypatch):
    captured = {}

    def fake_post(url, payload):
        captured["url"] = url
        captured["payload"] = payload

    monkeypatch.setattr(decision_service, "post_callback", fake_post)
    monkeypatch.setattr(
        decision_service.client.chat.completions,
        "create",
        _fake_groq(
            json.dumps({
                "suggested_scheduled_at": "2026-06-28T18:00:00Z",
                "reasoning": "ok",
            })
        ),
    )

    decision_service.process_decision(_request())

    assert captured["url"].endswith("/decision/callback")
    assert captured["payload"]["jobId"] == "job-123"
    assert "suggestedScheduledAt" in captured["payload"]["result"]


def test_process_decision_sends_error_callback_on_failure(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        decision_service,
        "post_callback",
        lambda url, payload: captured.update(payload=payload),
    )

    # Make build_decision itself raise (e.g. unexpected error path)
    def boom(req):
        raise RuntimeError("everything exploded")

    monkeypatch.setattr(decision_service, "build_decision", boom)

    decision_service.process_decision(_request())

    assert captured["payload"]["jobId"] == "job-123"
    assert captured["payload"]["error"]["code"] == "internal_error"
