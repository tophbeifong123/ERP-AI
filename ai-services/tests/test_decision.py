"""Tests for the AI Decision service (async-callback contract).

Rule guardrails return early WITHOUT calling Groq. The AI path and the
callback delivery are tested with mocks, so no real API/network calls happen.
"""
import json
from datetime import datetime, timedelta, timezone

from app.schemas.decision import (
    DecisionRequest,
    BusinessContext,
    RecentPost,
    ServiceInfo,
)
from app.services import decision_service


def _request(**overrides) -> DecisionRequest:
    data = dict(
        callback_url="https://api.example.com/internal/ai/decide/callback",
        plan_id="plan-123",
        business=BusinessContext(
            id="b1", name="Test Shop", posts_per_week_target=3, min_gap_days=1
        ),
        recent_posts=[],
        posts_this_week=0,
        last_post_at=None,
        now_iso=datetime(2026, 6, 28, 10, 0, tzinfo=timezone.utc),
        services=[ServiceInfo(id="svc-1", name="Latte", price=6500, currency="THB")],
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
    """Backend sends camelCase; the schema must parse it."""
    req = DecisionRequest.model_validate({
        "callbackUrl": "https://x/cb",
        "planId": "p1",
        "business": {"id": "b1", "name": "Shop", "postsPerWeekTarget": 2, "minGapDays": 1},
        "recentPosts": [{"postedAt": "2026-06-22T11:30:00Z", "postType": "promotion"}],
        "postsThisWeek": 1,
        "nowIso": "2026-06-28T06:00:00Z",
        "services": [],
    })
    assert req.business.posts_per_week_target == 2
    assert req.recent_posts[0].post_type == "promotion"


def test_blocks_when_weekly_target_reached():
    d = decision_service.build_decision(_request(posts_this_week=3))
    assert d.should_post is False
    assert "target" in d.reasoning.lower()


def test_blocks_when_last_post_too_recent():
    now = datetime(2026, 6, 28, 10, 0, tzinfo=timezone.utc)
    d = decision_service.build_decision(_request(
        last_post_at=now - timedelta(hours=5), posts_this_week=1, now_iso=now,
    ))
    assert d.should_post is False
    assert "gap" in d.reasoning.lower()


def test_ai_path_returns_decision(monkeypatch):
    fake = json.dumps({
        "should_post": True,
        "reasoning": "Good day to post",
        "suggested_scheduled_at": "2026-06-28T18:00:00Z",
        "post_type": "promotion",
        "featured_service_ids": ["svc-1"],
        "caption_hint": "เน้นโปร",
    })
    monkeypatch.setattr(decision_service.client.chat.completions, "create", _fake_groq(fake))

    d = decision_service.build_decision(_request())
    assert d.should_post is True
    assert d.post_type == "promotion"
    assert d.featured_service_ids == ["svc-1"]


def test_process_decision_posts_camelcase_callback(monkeypatch):
    """process_decision must POST a camelCase {planId, decision:{...}} payload."""
    captured = {}

    def fake_post(url, payload):
        captured["url"] = url
        captured["payload"] = payload

    monkeypatch.setattr(decision_service, "post_callback", fake_post)

    decision_service.process_decision(_request(posts_this_week=3))  # rule path, no Groq

    assert captured["url"].endswith("/decide/callback")
    assert captured["payload"]["planId"] == "plan-123"
    assert captured["payload"]["decision"]["shouldPost"] is False


def test_process_decision_sends_error_callback_on_failure(monkeypatch):
    """If the AI path throws, an error callback is sent (not a crash)."""
    captured = {}
    monkeypatch.setattr(decision_service, "post_callback",
                        lambda url, payload: captured.update(payload=payload))

    def boom(*args, **kwargs):
        raise RuntimeError("groq exploded")

    monkeypatch.setattr(decision_service.client.chat.completions, "create", boom)

    decision_service.process_decision(_request(posts_this_week=0))  # AI path

    assert captured["payload"]["planId"] == "plan-123"
    assert captured["payload"]["error"]["code"] == "internal_error"
