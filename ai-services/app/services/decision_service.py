"""AI Decision (time recommender) service.

Given a draft post + business context, ask the LLM to recommend the best
time to publish. Falls back to a sensible default (now + 2 hours) if the
LLM call fails.
"""
import json
import logging
from datetime import datetime, timedelta, timezone

from groq import Groq

from app.core.config import settings
from app.core.security import post_callback
from app.schemas.decision import (
    DecisionCallback,
    DecisionErrorCallback,
    DecisionRequest,
    DecisionResult,
    ErrorInfo,
)

logger = logging.getLogger(__name__)

client = Groq(api_key=settings.GROQ_API_KEY)
MODEL = "llama-3.3-70b-versatile"


def _build_prompt(req: DecisionRequest, now: datetime) -> str:
    services_text = (
        "\n".join(
            f"  - {s.name}" + (f" ({s.description})" if s.description else "")
            for s in req.featured_services
        )
        if req.featured_services
        else "  No services featured"
    )

    target = req.business.target_audience or "general Thai audience"

    return f"""You are a Thai SME social-media strategist. Recommend the best
publishing time for a Facebook post.

## Business
- Name: {req.business.name}
- Industry: {req.business.industry or 'N/A'}
- Tone: {req.business.tone or 'friendly'}
- Target audience: {target}

## Post
- Type: {req.post_type or 'promotion'}
- Hint: {req.caption_hint or 'N/A'}
- Featured services:
{services_text}

## Current time (UTC)
{now.strftime('%Y-%m-%d %H:%M')}

## Task
Pick a single best publish time within the next 24 hours, in UTC, that is
likely to maximize engagement for the target audience on Facebook.
Thai working-age audiences are most active around 12:00 and 19:00 local
(UTC+7) → 05:00 and 12:00 UTC.

Respond in EXACTLY this JSON format, no other text:
{{
  "suggested_scheduled_at": "YYYY-MM-DDTHH:MM:SSZ",
  "reasoning": "1 short sentence"
}}"""


def _fallback_time(now: datetime) -> datetime:
    """If LLM fails, schedule 2 hours from now (rounded to next 30 min)."""
    candidate = now + timedelta(hours=2)
    discard = timedelta(
        minutes=candidate.minute % 30,
        seconds=candidate.second,
        microseconds=candidate.microsecond,
    )
    return candidate - discard


def build_decision(req: DecisionRequest) -> DecisionResult:
    """Call the LLM to recommend a publish time. Falls back gracefully on errors."""
    now = req.now_iso or datetime.now(timezone.utc)
    try:
        prompt = _build_prompt(req, now)
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a marketing AI. Respond only with valid JSON.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.5,
            max_tokens=200,
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        data = json.loads(raw)
        ts = data.get("suggested_scheduled_at")
        if not ts:
            raise ValueError("LLM did not return suggested_scheduled_at")
        scheduled = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if scheduled < now:
            scheduled = _fallback_time(now)
        return DecisionResult(
            suggested_scheduled_at=scheduled,
            reasoning=data.get("reasoning"),
        )
    except Exception as e:
        logger.warning(f"Decision LLM call failed, using fallback: {e}")
        return DecisionResult(
            suggested_scheduled_at=_fallback_time(now),
            reasoning=f"Fallback time (LLM error: {type(e).__name__})",
        )


def process_decision(req: DecisionRequest) -> None:
    """Background task: run the recommender and POST the result to callbackUrl."""
    try:
        result = build_decision(req)
        payload = DecisionCallback(job_id=req.job_id, result=result)
    except Exception as e:
        logger.exception("Decision processing failed")
        payload = DecisionErrorCallback(
            job_id=req.job_id,
            error=ErrorInfo(code="internal_error", message=str(e)),
        )
    post_callback(
        req.callback_url, payload.model_dump(by_alias=True, mode="json")
    )
