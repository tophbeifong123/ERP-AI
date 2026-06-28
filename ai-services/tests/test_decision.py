"""Tests for the AI Decision service.

The rule-based guardrails (weekly target, min-gap) return early WITHOUT
calling Groq, so those tests need no mocking and run instantly. The AI path
is tested with a mocked Groq response.
"""
import json
from datetime import datetime, timedelta

from app.schemas.decision import (
    DecisionRequest,
    BusinessContext,
    PostingConfig,
    RecentPostInfo,
)
from app.services import decision_service


def _base_request(**overrides) -> DecisionRequest:
    """Build a valid DecisionRequest, letting tests override pieces."""
    data = dict(
        business=BusinessContext(business_id="b1", name="Test Shop"),
        posting_config=PostingConfig(posts_per_week_target=3, min_gap_days=1),
        recent_posts=RecentPostInfo(last_post_date=None, posts_this_week=0),
        services=[],
        current_time=datetime(2026, 6, 28, 10, 0),
    )
    data.update(overrides)
    return DecisionRequest(**data)


def test_blocks_when_weekly_target_reached():
    """If posts_this_week >= target, decline immediately (no AI call)."""
    req = _base_request(
        posting_config=PostingConfig(posts_per_week_target=3, min_gap_days=1),
        recent_posts=RecentPostInfo(posts_this_week=3),
    )
    resp = decision_service.decide(req)
    assert resp.should_post is False
    assert "target" in resp.reason.lower()


def test_blocks_when_last_post_too_recent():
    """If the last post is within min_gap_days, decline (no AI call)."""
    now = datetime(2026, 6, 28, 10, 0)
    req = _base_request(
        recent_posts=RecentPostInfo(
            last_post_date=now - timedelta(hours=5),  # same day
            posts_this_week=1,
        ),
        current_time=now,
    )
    resp = decision_service.decide(req)
    assert resp.should_post is False
    assert "gap" in resp.reason.lower()


def test_calls_ai_when_rules_pass(monkeypatch):
    """When guardrails pass, the AI decides. Groq is mocked here."""
    fake_ai_json = json.dumps({
        "should_post": True,
        "reason": "Good time to post",
        "suggested_scheduled_at": "2026-06-28T18:00:00",
        "post_type": "promotion",
        "featured_service_ids": ["svc-1"],
        "caption_hint": "เน้นโปรโมชั่น",
    })

    def fake_create(*args, **kwargs):
        # Mimic the shape of the Groq SDK response object.
        class _Msg:
            content = fake_ai_json

        class _Choice:
            message = _Msg()

        class _Resp:
            choices = [_Choice()]

        return _Resp()

    monkeypatch.setattr(decision_service.client.chat.completions, "create", fake_create)

    req = _base_request(recent_posts=RecentPostInfo(posts_this_week=0))
    resp = decision_service.decide(req)

    assert resp.should_post is True
    assert resp.post_type == "promotion"
    assert resp.featured_service_ids == ["svc-1"]
    assert resp.suggested_scheduled_at == datetime(2026, 6, 28, 18, 0)
