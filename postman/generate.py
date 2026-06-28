#!/usr/bin/env python3
"""Generate the Postman v2.1 collection for ERP-AI backend."""
import json
import os
from datetime import datetime, timedelta, timezone

OUT = os.path.join(os.path.dirname(__file__), "ERP-AI.postman_collection.json")


def iso_now_plus(hours=1):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat().replace("+00:00", "Z")


def req(name, method, path, rid, desc, body=None, headers=None,
        tests=None, raw_body=False):
    """Build a Postman request item. rid = unique request id."""
    headers = list(headers or [])
    if body is not None and not raw_body and not any(h.get("key") == "Content-Type" for h in headers):
        headers.append({"key": "Content-Type", "value": "application/json"})
    item = {
        "name": name,
        "id": rid,
        "request": {
            "method": method,
            "header": headers,
            "url": {
                "raw": "{{base_url}}" + path,
                "host": ["{{base_url}}"],
                "path": [p for p in path.split("/") if p],
            },
            "description": desc,
        },
        "response": [],
    }
    if body is not None and not raw_body:
        item["request"]["body"] = {"mode": "raw", "raw": json.dumps(body, indent=2)}
    if tests:
        item["event"] = [{"listen": "test", "script": {"type": "text/javascript", "exec": [tests]}}]
    return item


def folder(name, fid, items, desc=""):
    return {"name": name, "id": fid, "description": desc, "item": items}


# ---- Common test scripts ----
OK_2XX = 'pm.test("Status 2xx", () => pm.expect(pm.response.code).to.be.within(200,299));'
OK_200 = 'pm.test("Status 200", () => pm.response.to.have.status(200));'
OK_201 = 'pm.test("Status 201", () => pm.response.to.have.status(201));'
OK_202 = 'pm.test("Status 202", () => pm.response.to.have.status(202));'
OK_204 = 'pm.test("Status 204", () => pm.response.to.have.status(204));'
OK_400 = 'pm.test("Status 400", () => pm.response.to.have.status(400));'
OK_401 = 'pm.test("Status 401", () => pm.response.to.have.status(401));'
OK_403 = 'pm.test("Status 403", () => pm.response.to.have.status(403));'
OK_404 = 'pm.test("Status 404", () => pm.response.to.have.status(404));'
OK_409 = 'pm.test("Status 409", () => pm.response.to.have.status(409));'

SET_TOKENS = (
    "const j = pm.response.json();"
    "if (j.accessToken) { pm.environment.set('access_token', j.accessToken); pm.environment.set('refresh_token', j.refreshToken); }"
    "if (j.user) pm.environment.set('user_id', j.user.id);"
)
SET_BOB = (
    "const j = pm.response.json();"
    "if (j.accessToken) { pm.environment.set('bob_access_token', j.accessToken); }"
    "if (j.user) pm.environment.set('bob_user_id', j.user.id);"
)
SET_USER_ID = "const j = pm.response.json(); if (j.user && j.user.id) pm.environment.set('user_id', j.user.id);"
SET_BIZ = "const j = pm.response.json(); if (j.business && j.business.id) pm.environment.set('business_id', j.business.id);"
SET_SVC = "const j = pm.response.json(); if (j.service && j.service.id) pm.environment.set('service_id', j.service.id);"
SET_POST = "const j = pm.response.json(); if (j.post && j.post.id) pm.environment.set('post_id', j.post.id);"
SET_AUTO_POST = "const j = pm.response.json(); if (j.post && j.post.id) pm.environment.set('auto_ai_post_id', j.post.id);"
SET_PLAN = "const j = pm.response.json(); if (j.plan && j.plan.id) pm.environment.set('content_plan_id', j.plan.id);"

BEARER = {"key": "Authorization", "value": "Bearer {{access_token}}", "type": "text"}
BOB_BEARER = {"key": "Authorization", "value": "Bearer {{bob_access_token}}", "type": "text"}
INTERNAL = {"key": "X-Internal-Token", "value": "{{internal_token}}", "type": "text"}


# ============================================================
# 00 Health
# ============================================================
f00 = folder("00 Health", "f-health", [
    req("01 Health Check (public)", "GET", "/health", "r-health-01",
        "Public health endpoint. Returns 200 with subsystem statuses or 503 if degraded.",
        tests=OK_200 + '\npm.expect(pm.response.json().db).to.eql("ok");\npm.expect(pm.response.json().redis).to.eql("ok");\npm.expect(pm.response.json().storage).to.eql("ok");'),
])

# ============================================================
# 01 Auth
# ============================================================
f01 = folder("01 Auth", "f-auth", [
    req("01 Register (Alice)", "POST", "/auth/register", "r-auth-01",
        "Create a new user. Sends a verification email via BullMQ to Mailhog (http://localhost:8025).",
        body={"email": "{{email}}", "password": "{{password}}"},
        tests=SET_USER_ID + "\n" + OK_201,
    ),
    req("02 Verify Email (POST JSON)", "POST", "/auth/verify-email", "r-auth-02",
        "Verify using the token from Mailhog. ⚠️ Set `email_verification_token` env var first (copy from Mailhog URL).",
        body={"token": "{{email_verification_token}}"},
        tests=OK_200 + '\npm.expect(pm.response.json().message).to.eql("verified");',
    ),
    req("03 Login", "POST", "/auth/login", "r-auth-03",
        "Login. Auto-saves access_token, refresh_token, user_id.",
        body={"email": "{{email}}", "password": "{{password}}"},
        tests=SET_TOKENS + "\n" + OK_200,
    ),
    req("04 Refresh Token", "POST", "/auth/refresh", "r-auth-04",
        "Rotate refresh token. Old token revoked, new one issued.",
        body={"refreshToken": "{{refresh_token}}"},
        tests="const j = pm.response.json(); pm.environment.set('refresh_token', j.refreshToken); pm.environment.set('access_token', j.accessToken);" + "\n" + OK_200,
    ),
    req("05 Logout (Public)", "POST", "/auth/logout", "r-auth-05",
        "Revoke current refresh token. No Authorization header required.",
        body={"refreshToken": "{{refresh_token}}"},
        tests=OK_204,
    ),
    req("06 Verify Email Landing (GET)", "GET", "/auth/verify-email?token={{email_verification_token}}", "r-auth-06",
        "Browser-facing HTML page that verifies and redirects. Returns HTML 200.",
        tests='pm.test("HTML 200", () => { pm.response.to.have.status(200); pm.expect(pm.response.headers.get("Content-Type")).to.include("text/html"); });',
    ),
    req("07 Change Password", "POST", "/auth/change-password", "r-auth-07",
        "Change password. Requires auth. Revokes all OTHER refresh tokens (current stays if you pass refreshToken in body).",
        headers=[BEARER],
        body={"oldPassword": "{{password}}", "newPassword": "{{password}}"},
        tests=OK_200,
    ),
    req("08 Register Bob (for cross-user tests)", "POST", "/auth/register", "r-auth-08",
        "Create a second user for cross-user forbidden tests.",
        body={"email": "{{bob_email}}", "password": "{{bob_password}}"},
        tests=OK_201,
    ),
    req("09 Login Bob", "POST", "/auth/login", "r-auth-09",
        "Login Bob. Auto-saves bob_access_token.",
        body={"email": "{{bob_email}}", "password": "{{bob_password}}"},
        tests=SET_BOB + "\n" + OK_200,
    ),
    req("10 Forgot Password", "POST", "/auth/forgot-password", "r-auth-10",
        "Always returns 202. If email exists, sends reset link to Mailhog.",
        body={"email": "{{email}}"},
        tests=OK_202,
    ),
    req("11 Reset Password Landing (GET)", "GET", "/auth/reset-password?token={{password_reset_token}}", "r-auth-11",
        "Redirects to frontend reset form. Copy token from Mailhog.",
        tests='pm.test("HTML 200", () => { pm.response.to.have.status(200); pm.expect(pm.response.headers.get("Content-Type")).to.include("text/html"); });',
    ),
    req("12 Reset Password (POST JSON)", "POST", "/auth/reset-password", "r-auth-12",
        "Single-use. Revokes ALL refresh tokens. Set password_reset_token env first.",
        body={"token": "{{password_reset_token}}", "newPassword": "{{password}}"},
        tests=OK_200,
    ),
    req("13 Login (negative: wrong password)", "POST", "/auth/login", "r-auth-13",
        "Should return 401 invalid_credentials.",
        body={"email": "{{email}}", "password": "wrong-password"},
        tests=OK_401 + '\npm.expect(pm.response.json().error).to.eql("invalid_credentials");',
    ),
    req("14 Register (negative: short password)", "POST", "/auth/register", "r-auth-14",
        "Should return 400 validation error.",
        body={"email": "shortpass@example.com", "password": "short"},
        tests=OK_400,
    ),
    req("15 Register (negative: duplicate email)", "POST", "/auth/register", "r-auth-15",
        "Should return 409 email_taken.",
        body={"email": "{{email}}", "password": "{{password}}"},
        tests=OK_409 + '\npm.expect(pm.response.json().error).to.eql("email_taken");',
    ),
    req("16 Verify (negative: bad token)", "POST", "/auth/verify-email", "r-auth-16",
        "Should return 400 invalid_or_expired_token.",
        body={"token": "invalid-token-12345"},
        tests=OK_400,
    ),
])

# ============================================================
# 02 Users
# ============================================================
f02 = folder("02 Users", "f-users", [
    req("01 GET /me", "GET", "/me", "r-users-01",
        "Get current user info.",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("02 GET /me (no auth → 401)", "GET", "/me", "r-users-02",
        "Should return 401.",
        tests=OK_401,
    ),
    req("03 DELETE /me (skipped — destructive)", "DELETE", "/me", "r-users-03",
        "⚠️ Soft-deletes the user and revokes all refresh tokens. Don't run unless you want to start over.",
        headers=[BEARER],
        tests=OK_204,
    ),
])

# ============================================================
# 03 Businesses
# ============================================================
f03 = folder("03 Businesses", "f-biz", [
    req("01 Create Business (ai_decide)", "POST", "/businesses", "r-biz-01",
        "Create a business with autoPost=ai_decide. Auto-saves business_id.",
        headers=[BEARER],
        body={
            "name": "Acme Coffee",
            "industry": "F&B",
            "description": "Cozy coffee shop",
            "tone": "friendly",
            "keywords": ["coffee", "espresso", "latte"],
            "autoPost": {"enabled": True, "mode": "ai_decide", "postsPerWeekTarget": 3, "minGapDays": 1},
        },
        tests=SET_BIZ + "\n" + OK_201,
    ),
    req("02 Create Business (fixed_schedule)", "POST", "/businesses", "r-biz-02",
        "Create a second business with fixed_schedule autoPost.",
        headers=[BEARER],
        body={
            "name": "Bob's Bakery",
            "industry": "Food",
            "autoPost": {
                "enabled": True, "mode": "fixed_schedule",
                "postsPerWeekTarget": 2, "minGapDays": 2,
                "fixedScheduleRules": [{"dayOfWeek": 1, "time": "20:00"}, {"dayOfWeek": 4, "time": "10:00"}],
            },
        },
        tests='pm.environment.set("business2_id", pm.response.json().business.id);\n' + OK_201,
    ),
    req("03 List My Businesses", "GET", "/businesses", "r-biz-03",
        "List all businesses owned by current user.",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("04 GET /businesses/:id", "GET", "/businesses/{{business_id}}", "r-biz-04",
        "Get one business. OwnerGuard checks ownership.",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("05 PATCH /businesses/:id", "PATCH", "/businesses/{{business_id}}", "r-biz-05",
        "Update business name/description.",
        headers=[BEARER],
        body={"description": "Best coffee in town (updated)"},
        tests=OK_200,
    ),
    req("06 Upload Logo (multipart)", "POST", "/businesses/{{business_id}}/logo", "r-biz-06",
        "Upload logo as multipart/form-data. In Postman: Body → form-data → key 'logo' → File → pick a small PNG/JPG (<5MB).",
        headers=[BEARER],
        body=None,
        raw_body=True,
        tests=OK_201,
    ),
    req("07 PATCH /businesses/:id/auto-post", "PATCH", "/businesses/{{business_id}}/auto-post", "r-biz-07",
        "Update auto-post config (mode + cadence + fixed schedule).",
        headers=[BEARER],
        body={
            "enabled": True, "mode": "fixed_schedule", "postsPerWeekTarget": 2, "minGapDays": 2,
            "fixedScheduleRules": [{"dayOfWeek": 1, "time": "20:00"}, {"dayOfWeek": 4, "time": "10:00"}],
        },
        tests=OK_200,
    ),
    req("08 Cross-User Forbidden (Bob → Alice)", "GET", "/businesses/{{business_id}}", "r-biz-08",
        "OwnerGuard should return 403 not_owner.",
        headers=[BOB_BEARER],
        tests=OK_403 + '\npm.expect(pm.response.json().message).to.eql("not_owner");',
    ),
    req("09 List Businesses (no auth → 401)", "GET", "/businesses", "r-biz-09",
        "Should return 401.",
        tests=OK_401,
    ),
])

# ============================================================
# 04 Services
# ============================================================
f04 = folder("04 Services", "f-svc", [
    req("01 Create Service (Latte, 60 THB)", "POST", "/businesses/{{business_id}}/services", "r-svc-01",
        "Create a service. price is in THB, stored as satang (priceMinor=6000).",
        headers=[BEARER],
        body={"name": "Latte", "description": "Creamy latte with oat milk", "price": 60, "currency": "THB"},
        tests=SET_SVC + "\n" + OK_201 + '\npm.expect(pm.response.json().service.priceMinor.toString()).to.match(/6000|6000n/);',
    ),
    req("02 List Services (active only)", "GET", "/businesses/{{business_id}}/services?active=true&page=1&limit=20", "r-svc-02",
        "List active services (paginated).",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("03 GET /services/:id", "GET", "/services/{{service_id}}", "r-svc-03",
        "Get one service.",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("04 PATCH /services/:id (deactivate + price change)", "PATCH", "/services/{{service_id}}", "r-svc-04",
        "Update service. isActive toggle included.",
        headers=[BEARER],
        body={"isActive": False, "price": 75},
        tests=OK_200,
    ),
    req("05 DELETE /services/:id (skipped)", "DELETE", "/services/{{service_id}}", "r-svc-05",
        "⚠️ Soft-deletes the service.",
        headers=[BEARER],
        tests=OK_204,
    ),
])

# ============================================================
# 05 Facebook
# ============================================================
f05 = folder("05 Facebook", "f-fb", [
    req("01 OAuth Start (302 to Facebook)", "GET", "/facebook/oauth/start?businessId={{business_id}}", "r-fb-01",
        "Initiates Facebook OAuth. Returns 302 redirect to facebook.com. In a browser this starts the OAuth flow. In Postman, just observe the 302 + Location header.",
        headers=[BEARER],
        tests='pm.test("302 redirect", () => pm.response.to.have.status(302));\npm.expect(pm.response.headers.get("Location")).to.include("facebook.com");',
    ),
    req("02 OAuth Callback (no code → redirect to FE)", "GET", "/facebook/oauth/callback", "r-fb-02",
        "Missing code/state → redirects to FE with fb=missing_params.",
        tests='pm.test("302 redirect", () => pm.response.to.have.status(302));\npm.expect(pm.response.headers.get("Location")).to.include("fb=missing_params");',
    ),
    req("03 List Connected Pages (no session yet → 400)", "GET", "/facebook/pages?businessId={{business_id}}", "r-fb-03",
        "Returns 400 fb_session_expired unless OAuth flow completed in browser first.",
        headers=[BEARER],
        tests='pm.expect(pm.response.code).to.be.oneOf([400, 200]);',
    ),
])

# ============================================================
# 06 Posts
# ============================================================
f06 = folder("06 Posts", "f-posts", [
    req("01 Create Post (manual)", "POST", "/posts", "r-posts-01",
        "Create a manual post (status=draft). Auto-saves post_id.",
        headers=[BEARER],
        body={
            "businessId": "{{business_id}}",
            "caption": "Hello world!",
            "postType": "product_showcase",
            "generationSource": "manual",
        },
        tests=SET_POST + "\n" + OK_201,
    ),
    req("02 Create Post (auto_ai) — enqueues 3 AI jobs", "POST", "/posts", "r-posts-02",
        "Auto_AI: enqueues caption + image + short_video jobs, transitions post to 'generating'. Auto-saves auto_ai_post_id.",
        headers=[BEARER],
        body={
            "businessId": "{{business_id}}",
            "postType": "product_showcase",
            "generationSource": "auto_ai",
        },
        tests=SET_AUTO_POST + "\n" + OK_201,
    ),
    req("03 List Posts (filter by business)", "GET", "/posts?businessId={{business_id}}", "r-posts-03",
        "List all posts for a business.",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("04 GET /posts/:id", "GET", "/posts/{{post_id}}", "r-posts-04",
        "Get one post with media + aiJobs included.",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("05 PATCH /posts/:id (edit caption in draft)", "PATCH", "/posts/{{post_id}}", "r-posts-05",
        "Edits caption. Will 400 if post is approved/posted.",
        headers=[BEARER],
        body={"caption": "Edited caption"},
        tests=OK_200,
    ),
    req("06 Try Approve Draft (should 400)", "POST", "/posts/{{post_id}}/approve", "r-posts-06",
        "draft cannot go to approved. State machine should reject.",
        headers=[BEARER],
        tests=OK_400 + '\npm.expect(pm.response.json().error).to.eql("invalid_state_transition");',
    ),
    req("07 Reject Post (in draft → 400)", "POST", "/posts/{{post_id}}/reject", "r-posts-07",
        "draft cannot be rejected either. Run after 10.01 Caption Callback to test the happy path.",
        headers=[BEARER],
        body={"reason": "user_rejected"},
        tests=OK_400,
    ),
    req("08 Cross-User Forbidden (Bob → Alice)", "GET", "/posts/{{post_id}}", "r-posts-08",
        "OwnerGuard should return 403 not_owner.",
        headers=[BOB_BEARER],
        tests=OK_403 + '\npm.expect(pm.response.json().message).to.eql("not_owner");',
    ),
    req("09 List Posts (no auth → 401)", "GET", "/posts", "r-posts-09",
        "Should return 401.",
        tests=OK_401,
    ),
])

# ============================================================
# 07 Content Plans
# ============================================================
f07 = folder("07 Content Plans", "f-plans", [
    req("01 AI Decide Callback (creates content plan)", "POST", "/internal/ai/decide/callback", "r-plans-01",
        "Simulates AI service sending a daily decision. Creates a content plan. Auto-saves content_plan_id.",
        headers=[INTERNAL],
        body={
            "businessId": "{{business_id}}",
            "shouldPostToday": True,
            "reasoning": "Daily AI decision — promo day",
            "suggestedPostType": "product_showcase",
            "suggestedCaptionHint": "Try our new drink!",
            "suggestedScheduledAt": iso_now_plus(1),
        },
        tests=SET_PLAN + "\n" + OK_200,
    ),
    req("02 List Content Plans", "GET", "/content-plans?businessId={{business_id}}", "r-plans-02",
        "List all plans for a business.",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("03 GET /content-plans/:id", "GET", "/content-plans/{{content_plan_id}}", "r-plans-03",
        "Get one plan.",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("04 Materialize Plan (creates Post in draft)", "POST", "/content-plans/{{content_plan_id}}/materialize", "r-plans-04",
        "Plan → Post. Requires OwnerGuard. Returns {plan, post}.",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("05 Cancel Plan", "POST", "/content-plans/{{content_plan_id}}/cancel", "r-plans-05",
        "Cancel a plan (if not already materialized/cancelled).",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("06 Cross-User Forbidden (Bob → Alice's plan)", "POST", "/content-plans/{{content_plan_id}}/cancel", "r-plans-06",
        "Should return 403 not_owner.",
        headers=[BOB_BEARER],
        tests=OK_403,
    ),
])

# ============================================================
# 08 AI Jobs
# ============================================================
f08 = folder("08 AI Jobs", "f-aijobs", [
    req("01 List All AI Jobs", "GET", "/ai-jobs", "r-aijobs-01",
        "List all AI jobs for the current user's posts.",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("02 List AI Jobs (filter by auto_ai post)", "GET", "/ai-jobs?postId={{auto_ai_post_id}}", "r-aijobs-02",
        "Should show 3 jobs (caption, image, short_video) for the auto_ai post.",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("03 List AI Jobs (filter by type)", "GET", "/ai-jobs?type=caption", "r-aijobs-03",
        "Filter by type.",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("04 GET /ai-jobs/:id (uses env ai_job_id)", "GET", "/ai-jobs/{{ai_job_id}}", "r-aijobs-04",
        "Get one AI job. The ai_job_id env defaults to 11111111-... (INSERT a row first — see README).",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("05 Retry AI Job", "POST", "/ai-jobs/{{ai_job_id}}/retry", "r-aijobs-05",
        "Re-queue a failed job. No-op if not failed.",
        headers=[BEARER],
        tests=OK_200,
    ),
])

# ============================================================
# 09 Notifications
# ============================================================
f09 = folder("09 Notifications", "f-notif", [
    req("01 List Notifications (after 10.01 caption callback)", "GET", "/notifications", "r-notif-01",
        "Should show post_ready notification after 10.01 Caption Callback + 06.02 Create Post (auto_ai).",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("02 List Unread Only", "GET", "/notifications?unreadOnly=true", "r-notif-02",
        "Filter unread.",
        headers=[BEARER],
        tests=OK_200,
    ),
    req("03 POST /notifications/read-all", "POST", "/notifications/read-all", "r-notif-03",
        "Mark all unread as read.",
        headers=[BEARER],
        tests=OK_200,
    ),
])

# ============================================================
# 10 Internal AI Callbacks
# ============================================================
f10 = folder("10 Internal AI Callbacks", "f-internal", [
    req("01 Caption Callback (draft → pending_approval)", "POST", "/internal/ai/caption/callback", "r-internal-01",
        "Simulates AI caption service finishing. ⚠️ INSERT an ai_jobs row first (see README). Sets post caption, transitions to pending_approval, fires post_ready event (notification + email).",
        headers=[INTERNAL],
        body={"jobId": "{{ai_job_id}}", "caption": "AI-generated caption from Postman!"},
        tests=OK_200,
    ),
    req("02 Image Callback", "POST", "/internal/ai/image/callback", "r-internal-02",
        "Simulates AI image generation done.",
        headers=[INTERNAL],
        body={"jobId": "{{ai_job_id}}", "fileId": "00000000-0000-0000-0000-000000000001"},
        tests=OK_200,
    ),
    req("03 Short Video Callback", "POST", "/internal/ai/short_video/callback", "r-internal-03",
        "Simulates AI short video generation done.",
        headers=[INTERNAL],
        body={"jobId": "{{ai_job_id}}", "fileId": "00000000-0000-0000-0000-000000000002"},
        tests=OK_200,
    ),
    req("04 Job Fail (with retry)", "POST", "/internal/ai/job/fail", "r-internal-04",
        "Simulates AI job failure. Increments attempts, sets nextRunAt for retry (or fails at maxAttempts).",
        headers=[INTERNAL],
        body={"jobId": "{{ai_job_id}}", "errorCode": "E_TEST", "errorMessage": "Test failure from Postman", "retryInMs": 5000},
        tests=OK_200,
    ),
    req("05 Bad internal token → 401", "POST", "/internal/ai/caption/callback", "r-internal-05",
        "Missing or wrong X-Internal-Token → 401.",
        headers=[{"key": "X-Internal-Token", "value": "wrong-token", "type": "text"}],
        body={"jobId": "{{ai_job_id}}", "caption": "should fail"},
        tests=OK_401,
    ),
    req("06 No internal token → 401", "POST", "/internal/ai/caption/callback", "r-internal-06",
        "No X-Internal-Token header at all → 401.",
        body={"jobId": "{{ai_job_id}}", "caption": "should fail"},
        tests=OK_401,
    ),
])

# ============================================================
# Build the top-level collection
# ============================================================
collection = {
    "info": {
        "_postman_id": "erp-ai-collection-v1",
        "name": "ERP-AI (MarketMate) — Full Backend Test",
        "description": "End-to-end test collection for the P0/P1/P2 backend. Run folders in order; the tests in each request auto-store tokens/IDs into env vars. See README.md for the full flow walkthrough.",
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0",
    },
    "item": [f00, f01, f02, f03, f04, f05, f06, f07, f08, f09, f10],
    "event": [
        {
            "listen": "prerequest",
            "script": {
                "type": "text/javascript",
                "exec": [
                    "// Global pre-request hook",
                    "console.log('--- pre-request: ' + pm.info.requestName + ' [' + pm.request.method + ' ' + pm.request.url.toString() + ']');",
                ],
            },
        },
        {
            "listen": "test",
            "script": {
                "type": "text/javascript",
                "exec": [
                    "// Global test hook: log response",
                    "console.log('--- response: ' + pm.response.code + ' ' + pm.response.status + ' for ' + pm.info.requestName);",
                ],
            },
        },
    ],
    "variable": [{"key": "base_url", "value": "http://localhost:3000"}],
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(collection, f, indent=2, ensure_ascii=False)

print(f"Wrote {OUT}")
print(f"Size: {os.path.getsize(OUT)} bytes")
print(f"Folders: {len(collection['item'])}")
print(f"Total requests: {sum(len(f['item']) for f in collection['item'])}")
