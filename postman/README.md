# ERP-AI (MarketMate) — Postman Collection

End-to-end test collection for the **P0/P1/P2** backend running at `http://localhost:3000`.

## Import

1. Open **Postman** → **Import** → **Upload Files**
2. Select both files in this folder:
   - `ERP-AI.postman_collection.json`
   - `ERP-AI.postman_environment.json`
3. In the top-right environment dropdown, pick **`ERP-AI Local`**
4. Open the **`Auth → 01 Register`** request and hit **Send**
5. Open Mailhog (http://localhost:8025), copy the token, paste it into the **`email_verification_token`** env variable
6. Run the collection folder-by-folder (the tests in each request auto-store tokens/IDs into env vars)

## Folders (in order)

| # | Folder | What it covers |
|---|---|---|
| 1 | `00 Health` | `GET /health` (public) |
| 2 | `01 Auth` | register, verify (JSON + landing), login, refresh, logout, change-password, forgot/reset password |
| 3 | `02 Users` | `GET /me`, `DELETE /me` |
| 4 | `03 Businesses` | CRUD + logo upload + auto-post config |
| 5 | `04 Services` | CRUD under business |
| 6 | `05 Facebook` | OAuth start/callback/pages/connect/disconnect |
| 7 | `06 Posts` | CRUD + approve + reject + soft-delete |
| 8 | `07 Content Plans` | list, get, materialize, cancel |
| 9 | `08 AI Jobs` | list, get, retry |
| 10 | `09 Notifications` | list, get, mark-read, mark-all-read |
| 11 | `10 Internal AI Callbacks` | decide, caption, image, short_video, fail (uses `X-Internal-Token`) |

## Environment variables (auto-populated by tests)

| Variable | Set by | Description |
|---|---|---|
| `base_url` | manual | `http://localhost:3000` |
| `email` | manual | e.g. `alice@example.com` |
| `password` | manual | e.g. `correcthorsebatterystaple` |
| `internal_token` | manual | `dev-internal-api-key` (matches `INTERNAL_API_KEY` in `.env`) |
| `access_token` | `POST /auth/login` | Bearer token for protected routes |
| `refresh_token` | `POST /auth/login` | For `POST /auth/refresh` |
| `user_id` | `POST /auth/register` / `GET /me` | Current user id |
| `email_verification_token` | manual from Mailhog | From `GET /api/v2/messages` in Mailhog UI |
| `password_reset_token` | manual from Mailhog | From reset email |
| `business_id` | `POST /businesses` | First business |
| `business2_id` | `POST /businesses` (in flow) | Second business (for cross-user tests) |
| `service_id` | `POST /businesses/:id/services` | First service |
| `post_id` | `POST /posts` | First post (manual) |
| `auto_ai_post_id` | `POST /posts` (auto_ai) | Post for AI pipeline test |
| `content_plan_id` | `POST /internal/ai/decide/callback` | Plan to materialize |
| `ai_job_id` | `INSERT INTO ai_jobs...` (manual SQL) | For caption callback |
| `fb_page_id` | manual | UUID of a connected Facebook page (optional, for dispatch test) |
| `bob_access_token` | `01 Auth → 08 Register Bob` | For cross-user forbidden tests |
| `bob_user_id` | `01 Auth → 08 Register Bob` | Bob's id |

## Recommended end-to-end flow

1. **00 Health** → confirm server is up
2. **01.01 Register** → 201
3. Open **Mailhog** (http://localhost:8025) → click the email → copy token from URL
4. Paste into env `email_verification_token`
5. **01.02 Verify Email (POST JSON)** → 200
6. **02.01 GET /me** → 200
7. **01.03 Login** → 200 (auto-saves `access_token`, `refresh_token`, `user_id`)
8. **03.01 Create Business** → 201 (auto-saves `business_id`)
9. **03.06 Upload Logo** → 201 (use any small PNG)
10. **04.01 Create Service** → 201 (auto-saves `service_id`, `business_id`)
11. **07.01 Create Post (manual)** → 201
12. **07.05 Try Approve Draft** → 400 (state machine blocks)
13. **10.01 Caption Callback** → simulates AI service finishing — see `ai_job_id` below
14. **07.06 Approve Post** → 200 (now works)
15. **07.07 Try Edit After Approve** → 400
16. **09.01 List Notifications** → 1 `post_ready` entry
17. **07.08 Reject After Approve** → 400
18. **08.01 Materialize a Plan** → 200 (plan → new post in `draft`)

## Setting up `ai_job_id`

The caption callback requires an `ai_jobs` row to exist. Run this SQL once after creating `auto_ai_post_id`:

```sql
INSERT INTO ai_jobs (id, post_id, type, status, attempts, max_attempts, payload, next_run_at, created_at, updated_at)
VALUES ('11111111-1111-1111-1111-111111111111', '<auto_ai_post_id>', 'caption', 'queued', 0, 3, '{}'::jsonb, NOW(), NOW(), NOW());
```

Then set `ai_job_id` env var to `11111111-1111-1111-1111-111111111111` and run **10.01 Caption Callback**.

## Verifying cron jobs

Cron jobs run on the server. Watch them with:

```bash
docker exec erp-ai-postgres psql -U erp -d erp_ai -c "SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 5;"
docker exec erp-ai-postgres psql -U erp -d erp_ai -c "SELECT type, COUNT(*) FROM notifications GROUP BY type;"
```

Or watch the server log: the `SchedulerService` prints every minute / 30s.

## Troubleshooting

- **401 on protected route** → re-run `01.03 Login`; token expires in 15 min
- **403 email_not_verified** → check step 5 above
- **Cross-user 403 not_owner** → intentional; test is in `03.07 Cross-User Forbidden`
- **Internal 401** → `internal_token` env var is `dev-internal-api-key`
- **Server not responding** → `curl http://localhost:3000/health`
