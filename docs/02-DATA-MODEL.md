# 02. แบบจำลองข้อมูล (Data Model)

> PostgreSQL 15 + TypeORM entities + migrations

---

## 1. ER Diagram (ภาพรวม)

```
              ┌──────────┐
              │  users   │
              └─────┬────┘
                    │ 1:N
                    ▼
              ┌──────────────┐         ┌──────────────┐
              │ businesses   │◀────────│   files      │
              └─────┬────────┘ logo   │  (logo)      │
                    │                   └──────────────┘
        ┌───────────┼───────────┬──────────────┐
        │ 1:N       │ 1:N       │ 1:1          │ 1:N
        ▼           ▼           ▼              ▼
   ┌─────────┐ ┌─────────┐ ┌────────────┐ ┌──────────────┐
   │services │ │  posts  │ │facebook_   │ │content_plans │
   │         │ │         │ │  pages     │ │              │
   └────┬────┘ └────┬────┘ └────────────┘ └──────┬───────┘
        │           │                              │
        │ M2M       │ 1:N                          │ 1:1
        │           ▼                              ▼
        │     ┌────────────┐                  (post)
        │     │ post_media │                  (created)
        │     └─────┬──────┘
        │           │ N:1
        └──────────▶│
                    ▼
                ┌──────────────┐
                │  ai_jobs     │ → caption/image/short_video
                └──────────────┘

   ┌──────────────────┐  ┌──────────────────┐
   │ refresh_tokens   │  │ email_verifications│
   └──────────────────┘  └──────────────────┘

   ┌──────────────────┐  ┌──────────────────┐
   │  notifications   │  │  email_logs      │
   └──────────────────┘  └──────────────────┘
```

---

## 2. ตารางทั้งหมด

### 2.1 `users` — ผู้ใช้

| Column | Type | Constraints | คำอธิบาย |
|---|---|---|---|
| `id` | uuid | PK | gen_random_uuid() |
| `email` | citext | UNIQUE NOT NULL | email (case-insensitive) |
| `password_hash` | text | NOT NULL | argon2id |
| `email_verified_at` | timestamptz | NULL | null = ยังไม่ verify |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | trigger |
| `deleted_at` | timestamptz | NULL | soft delete |

**Indexes:**
- `email` (unique อยู่แล้ว)
- `deleted_at` partial WHERE NOT NULL

---

### 2.2 `refresh_tokens` — Refresh tokens (อนุญาตให้ revoke)

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK users ON DELETE CASCADE |
| `token_hash` | text | UNIQUE — sha256 ของ opaque token |
| `expires_at` | timestamptz | NOT NULL |
| `revoked_at` | timestamptz | NULL |
| `replaced_by_id` | uuid | NULL — token ใหม่ที่ใช้แทน (rotation chain) |
| `user_agent` | text | NULL |
| `ip` | inet | NULL |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

---

### 2.3 `email_verifications` — Token สำหรับยืนยันอีเมล

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK users ON DELETE CASCADE |
| `token_hash` | text | UNIQUE |
| `expires_at` | timestamptz | NOT NULL (24h) |
| `used_at` | timestamptz | NULL |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

---

### 2.4 `password_resets` — Token สำหรับรีเซ็ตรหัสผ่าน

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK users ON DELETE CASCADE |
| `token_hash` | text | UNIQUE |
| `expires_at` | timestamptz | NOT NULL (1h) |
| `used_at` | timestamptz | NULL |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

---

### 2.5 `businesses` — ธุรกิจ

| Column | Type | Constraints | คำอธิบาย |
|---|---|---|---|
| `id` | uuid | PK | |
| `owner_id` | uuid | FK users | เจ้าของ |
| `name` | text | NOT NULL | |
| `industry` | text | NOT NULL | |
| `description` | text | NULL | |
| `target_audience` | text | NULL | |
| `tone` | text | NULL | |
| `keywords` | text[] | NOT NULL DEFAULT '{}' | Postgres array |
| `auto_post_enabled` | boolean | NOT NULL DEFAULT false | |
| `auto_post_mode` | text | NULL CHECK IN ('ai_decide','fixed_schedule') | |
| `posts_per_week_target` | smallint | NOT NULL DEFAULT 3 CHECK BETWEEN 1 AND 14 | เป้าหมวนโพสต์/สัปดาห์ |
| `min_gap_days` | smallint | NOT NULL DEFAULT 1 CHECK BETWEEN 0 AND 7 | ระยะห่างขั้นต่ำ |
| `fixed_schedule_rules` | jsonb | NOT NULL DEFAULT '[]' | ใช้เมื่อ mode=fixed_schedule |
| `logo_file_id` | uuid | FK files NULL | โลโก้ |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | trigger |
| `deleted_at` | timestamptz | NULL | soft delete |

**Indexes:**
- `(owner_id) WHERE deleted_at IS NULL`

**`fixed_schedule_rules` JSON shape:**
```json
[
  { "dayOfWeek": 1, "time": "20:00" },
  { "dayOfWeek": 4, "time": "10:00" }
]
```
- `dayOfWeek`: 0=อาทิตย์, 1=จันทร์, ..., 6=เสาร์
- `time`: HH:mm (Asia/Bangkok)

---

### 2.6 `services` — บริการ/สินค้า

| Column | Type | Constraints | คำอธิบาย |
|---|---|---|---|
| `id` | uuid | PK | |
| `business_id` | uuid | FK businesses ON DELETE CASCADE | |
| `name` | text | NOT NULL | |
| `description` | text | NULL | |
| `price_minor` | bigint | NOT NULL | ราคาเป็น **สตางค์** (6000 = 60 บาท) |
| `currency` | char(3) | NOT NULL DEFAULT 'THB' CHECK (currency='THB') | THB เท่านั้นใน MVP |
| `image_file_id` | uuid | FK files NULL | รูปภาพ (optional) |
| `is_active` | boolean | NOT NULL DEFAULT true | |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | trigger |
| `deleted_at` | timestamptz | NULL | soft delete |

**Indexes:**
- `(business_id) WHERE deleted_at IS NULL AND is_active = true`

---

### 2.7 `files` — ไฟล์ (logo, service image, post media)

| Column | Type | Constraints | คำอธิบาย |
|---|---|---|---|
| `id` | uuid | PK | |
| `owner_id` | uuid | FK users | เจ้าของ |
| `kind` | text | NOT NULL CHECK IN ('logo','service_image','post_media') | |
| `storage_key` | text | NOT NULL | เช่น `logos/2026/06/27/abc.png` |
| `mime` | text | NOT NULL | เช่น `image/png` |
| `size_bytes` | bigint | NOT NULL | |
| `public_url` | text | NOT NULL | URL สาธารณะ |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |
| `deleted_at` | timestamptz | NULL | soft delete |

**Indexes:**
- `(owner_id)`
- `(kind, created_at)`

---

### 2.8 `facebook_pages` — เพจที่เชื่อมต่อ

| Column | Type | Constraints | คำอธิบาย |
|---|---|---|---|
| `id` | uuid | PK | |
| `business_id` | uuid | FK businesses ON DELETE CASCADE | |
| `fb_page_id` | text | NOT NULL | |
| `page_name` | text | NOT NULL | |
| `picture_url` | text | NULL | |
| `access_token_encrypted` | bytea | NOT NULL | AES-GCM (key ใน env) |
| `token_expires_at` | timestamptz | NOT NULL | |
| `scopes` | text[] | NOT NULL DEFAULT '{}' | |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | trigger |
| `deleted_at` | timestamptz | NULL | soft delete |

**Indexes:**
- UNIQUE `(business_id, fb_page_id) WHERE deleted_at IS NULL`
- `(token_expires_at)`

---

### 2.9 `content_plans` — แผนโพสต์ (จาก AI Decision)

| Column | Type | Constraints | คำอธิบาย |
|---|---|---|---|
| `id` | uuid | PK | |
| `business_id` | uuid | FK businesses ON DELETE CASCADE | |
| `decided_by` | text | NOT NULL CHECK IN ('ai','user') | |
| `should_post_today` | boolean | NOT NULL DEFAULT true | |
| `status` | text | NOT NULL DEFAULT 'planned' CHECK IN ('planned','materialized','cancelled') | |
| `ai_reasoning` | text | NULL | เหตุผลจาก AI |
| `suggested_post_type` | text | NULL | |
| `suggested_featured_service_ids` | uuid[] | NOT NULL DEFAULT '{}' | |
| `suggested_caption_hint` | text | NULL | |
| `suggested_scheduled_at` | timestamptz | NULL | |
| `target_window_start` | timestamptz | NULL | ใช้กับ fixed_schedule |
| `target_window_end` | timestamptz | NULL | |
| `payload_json` | jsonb | NOT NULL DEFAULT '{}' | |
| `materialized_post_id` | uuid | FK posts NULL | post ที่ถูกสร้างจาก plan นี้ |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |

---

### 2.10 `posts` — โพสต์

| Column | Type | Constraints | คำอธิบาย |
|---|---|---|---|
| `id` | uuid | PK | |
| `business_id` | uuid | FK businesses ON DELETE CASCADE | |
| `fb_page_id` | uuid | FK facebook_pages NULL | null = ยังไม่ได้เลือก (เฉพาะ draft) |
| `caption` | text | NULL | แก้ไขได้ตอน pending_approval |
| `status` | text | NOT NULL CHECK IN ('draft','generating','pending_approval','approved','posted','rejected','expired','failed') | ดู state machine |
| `post_type` | text | NULL CHECK IN ('promotion','product_showcase','brand_awareness','event') | |
| `generation_source` | text | NOT NULL CHECK IN ('auto_ai','fixed_schedule','manual') | |
| `scheduled_at` | timestamptz | NULL | เวลาจะโพสต์ (UTC) |
| `approval_deadline` | timestamptz | NULL | = scheduled_at (auto-reject เมื่อถึง) |
| `posted_at` | timestamptz | NULL | |
| `fb_post_id` | text | NULL | ID จาก Facebook |
| `rejection_reason` | text | NULL CHECK IN ('user_rejected','timeout') | |
| `error_code` | text | NULL | เช่น `fb_api_error` |
| `error_message` | text | NULL | |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | trigger |
| `deleted_at` | timestamptz | NULL | soft delete |

**Indexes:**
- `(business_id, status, created_at DESC)` — dashboard list
- `(status, scheduled_at) WHERE status = 'approved'` — dispatcher scan
- `(status, scheduled_at) WHERE status = 'pending_approval'` — expirer scan
- `(business_id, posted_at DESC) WHERE status = 'posted'` — history

---

### 2.11 `post_media` — สื่อของโพสต์ (1 รายการต่อโพสต์ใน MVP)

| Column | Type | Constraints | คำอธิบาย |
|---|---|---|---|
| `id` | uuid | PK | |
| `post_id` | uuid | FK posts ON DELETE CASCADE | |
| `file_id` | uuid | FK files | |
| `kind` | text | NOT NULL CHECK IN ('image','short_video') | |
| `order_index` | int | NOT NULL DEFAULT 0 | |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |

**Unique:** `(post_id, order_index)`

---

### 2.12 `post_featured_services` — M2M

| Column | Type | Constraints |
|---|---|---|
| `post_id` | uuid | FK posts ON DELETE CASCADE |
| `service_id` | uuid | FK services ON DELETE CASCADE |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

**Primary key:** `(post_id, service_id)`

---

### 2.13 `ai_jobs` — งาน AI (async)

| Column | Type | Constraints | คำอธิบาย |
|---|---|---|---|
| `id` | uuid | PK | |
| `post_id` | uuid | FK posts ON DELETE CASCADE | |
| `plan_id` | uuid | FK content_plans NULL | เชื่อมกับแผน |
| `type` | text | NOT NULL CHECK IN ('caption','image','short_video') | |
| `status` | text | NOT NULL DEFAULT 'queued' CHECK IN ('queued','running','succeeded','failed') | |
| `attempts` | int | NOT NULL DEFAULT 0 | |
| `max_attempts` | int | NOT NULL DEFAULT 3 | |
| `last_error` | text | NULL | |
| `payload` | jsonb | NOT NULL DEFAULT '{}' | request ที่ส่งไป AI |
| `result` | jsonb | NULL | response ที่ AI ตอบกลับ |
| `next_run_at` | timestamptz | NOT NULL DEFAULT now() | สำหรับ retry |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | trigger |

**Indexes:**
- `(status, next_run_at)` — retry scanner
- `(post_id)`

---

### 2.14 `notifications`

| Column | Type | Constraints | คำอธิบาย |
|---|---|---|---|
| `id` | uuid | PK | |
| `user_id` | uuid | FK users | |
| `post_id` | uuid | FK posts NULL | |
| `type` | text | NOT NULL CHECK IN ('post_ready','post_posted','post_failed','post_expired') | |
| `channel` | text | NOT NULL DEFAULT 'email' CHECK (channel='email') | |
| `read_at` | timestamptz | NULL | |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |

---

### 2.15 `email_logs` — บันทึกการส่งอีเมล

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK users |
| `template` | text | NOT NULL |
| `payload` | jsonb | NOT NULL DEFAULT '{}' |
| `status` | text | NOT NULL DEFAULT 'queued' CHECK IN ('queued','sent','failed') |
| `provider_message_id` | text | NULL |
| `error` | text | NULL |
| `sent_at` | timestamptz | NULL |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

---

### 2.16 `unsubscribes` — Token สำหรับยกเลิกรับอีเมล

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK users |
| `token` | text | UNIQUE — opaque |
| `category` | text | NOT NULL CHECK IN ('marketing','transactional') |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

---

## 3. Migration Strategy

- **Tool:** TypeORM migrations (`typeorm migration:generate`, `typeorm migration:run`)
- **ทิศทาง:** forward-only เท่านั้น (ไม่ rollback)
- **Commit:** migration ทุกไฟล์ต้องถูก commit ใน PR เดียวกับ entity
- **ลำดับ:** รัน migrations ตามลำดับ timestamp

### ตัวอย่างชื่อไฟล์ migration

```
1700000000000-InitSchema.ts
1700000001000-AddBusinessCadence.ts
1700000002000-AddPostStatusExpired.ts
1700000003000-AddAiJobTypeShortVideo.ts
```

---

## 4. Naming Conventions

- **Tables:** snake_case, plural (`users`, `posts`, `facebook_pages`)
- **Columns:** snake_case (`owner_id`, `created_at`, `email_verified_at`)
- **Primary key:** `id` (uuid)
- **Foreign key:** `<table_singular>_id` (เช่น `business_id`)
- **Timestamps:** `created_at`, `updated_at`, `deleted_at` (soft delete)
- **Enums:** เก็บเป็น text + CHECK constraint (ไม่ใช้ Postgres ENUM เพราะแก้ยาก)

---

## 5. หมายเหตุสำคัญ

### 5.1 เก็บเงินเป็นสตางค์ (Minor Units)

```typescript
// Backend เก็บ
price_minor: 6000n  // 60 บาท (bigint)

// Frontend แสดง
const baht = Number(price_minor) / 100;  // 60
```

### 5.2 เก็บเวลาเป็น UTC

- **ทุก** `timestamptz` เก็บเป็น UTC
- Frontend แปลงเป็น Asia/Bangkok ตอนแสดง
- AI services รับ/ส่งเป็น UTC แต่คำนวณเวลาจาก Asia/Bangkok

### 5.3 Soft Delete

- ใช้ `deleted_at IS NULL` แทนการลบจริง
- ทุก query ที่ list/get ต้อง filter `deleted_at IS NULL`

### 5.4 เข้ารหัส Token

- `access_token_encrypted` (Facebook Page) เข้ารหัสด้วย **AES-256-GCM**
- Key เก็บใน env (`FB_TOKEN_ENCRYPTION_KEY`)

### 5.5 ไม่มี Image Regen ใน MVP

- `posts` มี `post_media` ได้ **1 รายการ** (image หรือ short_video)
- ไม่มี flow regenerate — ถ้าจะเปลี่ยนต้องลบ post เก่าแล้วสร้างใหม่

---

## 6. อ่านเพิ่มเติม

- [`01-OVERVIEW.md`](./01-OVERVIEW.md) — ภาพรวมระบบ
- [`03-POST-LIFECYCLE.md`](./03-POST-LIFECYCLE.md) — state machine
- [`06-AUTH.md`](./06-AUTH.md) — auth schema

อัปเดตล่าสุด: 2026-06-27
