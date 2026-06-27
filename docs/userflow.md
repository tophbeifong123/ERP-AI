# User Flow — ทุก Flow ที่ผู้ใช้จะเจอ

> เอกสารนี้อธิบายทุก flow ที่ user จะเจอ ตั้งแต่สมัครสมาชิกจนใช้งานจริง
> ครอบคลุม 11 เรื่องหลัก + ตาราง email ทั้งหมด + สรุปสิทธิ์การเข้าถึง
>
> เวอร์ชัน: 2026-06-27

---

## สารบัญ

1. [สมัครสมาชิก (Register)](#1-สมัครสมาชิก-register)
2. [ยืนยันอีเมล (Verify Email)](#2-ยืนยันอีเมล-verify-email)
3. [เข้าสู่ระบบ (Login)](#3-เข้าสู่ระบบ-login)
4. [ลืมรหัสผ่าน / รีเซ็ตรหัสผ่าน](#4-ลืมรหัสผ่าน--รีเซ็ตรหัสผ่าน)
5. [ออกจากระบบ (Logout)](#5-ออกจากระบบ-logout)
6. [Onboarding — สร้างธุรกิจแรก](#6-onboarding--สร้างธุรกิจแรก)
7. [Dashboard หลัก](#7-dashboard-หลัก)
8. [Daily AI Pipeline (Flow หลัก 06:00 น.)](#8-daily-ai-pipeline-flow-หลัก-0600-น--flow-อัตโนมัติ)
9. [Manual Post (สร้างโพสต์ด้วยตนเอง)](#9-manual-post-สร้างโพสต์ด้วยตนเอง)
10. [โหมด Fixed Schedule](#10-โหมด-fixed-schedule-ทางเลือกแทน-ai-decide)
11. [จัดการบัญชี / ตั้งค่า](#11-จัดการบัญชี--ตั้งค่า)

ภาคผนวก:
- [ตาราง Email ทั้งหมดที่ User ได้รับ](#ตาราง-email-ทั้งหมดที่-user-จะได้รับ)
- [สรุป Roles / Permissions](#สรุป-roles--permissions)

---

## 1. สมัครสมาชิก (Register)

**Trigger:** ผู้ใช้ใหม่เข้าหน้าเว็บ

### UI

```
┌──────────────────────────┐
│  สมัครสมาชิก              │
│  ─────────                │
│  Email:    [_________]    │
│  Password: [_________]    │
│  ยืนยันรหัสผ่าน: [_____]  │
│                           │
│  [ สมัครสมาชิก ]           │
└──────────────────────────┘
```

### Flow

1. User กรอก email + password (≥ 8 ตัวอักษร) + ยืนยันรหัสผ่าน
2. Frontend เรียก `POST /auth/register { email, password }`
3. Backend:
   - Validate email format + password strength
   - Hash password ด้วย argon2id
   - INSERT `users` (email_verified_at = NULL)
   - สร้าง verification token (UUID + hash เก็บ DB, TTL 24 ชั่วโมง)
   - Enqueue email "ยืนยันอีเมล" พร้อม link `https://app/verify-email?token=xxx`
   - ตอบ 201 Created
4. Frontend แสดงหน้า "ส่งอีเมลยืนยันไปแล้ว กรุณาเช็คกล่องจดหมาย"

### Edge cases

| กรณี | ผลลัพธ์ |
|---|---|
| Email ซ้ำ | 409 `email_taken` — "อีเมลนี้ถูกใช้แล้ว" |
| Password < 8 ตัว | 422 `validation_failed` — "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" |
| Email format ผิด | 422 `validation_failed` |
| Token หมดอายุ | 401 — ปุ่ม "ส่งอีเมลยืนยันใหม่" |

---

## 2. ยืนยันอีเมล (Verify Email)

**Trigger:** User คลิก link ในอีเมล

### Email ที่ส่ง

```
┌────────────────────────────────────────┐
│ ยืนยันอีเมลของคุณ                         │
│ กรุณาคลิกปุ่มด้านล่างเพื่อยืนยันอีเมล         │
│                                         │
│ [ ยืนยันอีเมล ]                          │
│                                         │
│ Link หมดอายุใน 24 ชั่วโมม               │
└────────────────────────────────────────┘
```

### Flow

1. User คลิกปุ่ม → เปิดหน้า `https://app/verify-email?token=xxx`
2. Frontend เรียก `POST /auth/verify-email { token }`
3. Backend:
   - Hash token เทียบกับใน DB
   - เช็คว่ายังไม่หมดอายุ + ยังไม่ถูกใช้
   - UPDATE `users.email_verified_at = now()`, mark token ใช้แล้ว
   - ตอบ 200 OK
4. Frontend redirect ไปหน้า login

**หลังจากนี้:** ทุก endpoint ที่ต้องการ auth (และใช้ `EmailVerifiedGuard`) จะทำงานได้

---

## 3. เข้าสู่ระบบ (Login)

### UI

```
┌──────────────────────────┐
│  เข้าสู่ระบบ              │
│  ─────────                │
│  Email:    [_________]    │
│  Password: [_________]    │
│                           │
│  [ เข้าสู่ระบบ ]           │
│  ลืมรหัสผ่าน?              │
│  ยังไม่มีบัญชี? สมัครเลย   │
└──────────────────────────┘
```

### Flow

1. User กรอก email + password
2. Frontend เรียก `POST /auth/login { email, password }`
3. Backend:
   - หา user, verify password
   - เช็ค email verified (ถ้าไม่ → 403 `email_not_verified`)
   - สร้าง **access token** (JWT, TTL 15 นาที)
   - สร้าง **refresh token** (opaque, TTL 7 วัน, hash เก็บ DB)
   - INSERT `refresh_tokens` (user_agent, ip)
   - ตอบ 200 { accessToken, refreshToken, expiresIn: 900 }
4. Frontend:
   - เก็บ access token ใน memory (state)
   - เก็บ refresh token ใน httpOnly cookie
   - redirect ไป Dashboard

### Token Refresh

- เมื่อ access token หมดอายุ (15 นาที) → Frontend เรียก `POST /auth/refresh { refreshToken }` → ได้ access token ใหม่
- ถ้า refresh token ถูก revoke → 401 → redirect ไป login

---

## 4. ลืมรหัสผ่าน / รีเซ็ตรหัสผ่าน

### Step 1: ขอรีเซ็ต

**UI:**
```
┌──────────────────────────┐
│  ลืมรหัสผ่าน              │
│  ─────────                │
│  Email: [_________]       │
│                           │
│  [ ส่งลิงก์รีเซ็ต ]        │
└──────────────────────────┘
```

**Flow:**
1. Frontend เรียก `POST /auth/forgot-password { email }`
2. Backend:
   - ถ้า email มีอยู่ → สร้าง reset token (TTL 1 ชั่วโมง), ส่งอีเมล
   - **ตอบ 200 เสมอ** (ไม่เปิดเผยว่า email มีอยู่หรือไม่ — กัน user enumeration)
3. Frontend แสดง "หากอีเมลนี้มีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตไปให้"

### Step 2: ตั้งรหัสผ่านใหม่

**Email ที่ส่ง:**
```
[ ตั้งรหัสผ่านใหม่ ]  →  Link: /reset-password?token=xxx
```

**UI ตั้งรหัสผ่านใหม่:**
```
รหัสผ่านใหม่: [______]
ยืนยัน:       [______]
[ บันทึก ]
```

**Flow:**
1. Frontend เรียก `POST /auth/reset-password { token, newPassword }`
2. Backend:
   - Verify token
   - UPDATE `users.password_hash`
   - Revoke refresh tokens ทั้งหมดของ user (force re-login)
   - ตอบ 200
3. Frontend redirect ไป login

---

## 5. ออกจากระบบ (Logout)

### Flow

1. User คลิก "ออกจากระบบ"
2. Frontend เรียก `POST /auth/logout` (พร้อม access token)
3. Backend: mark `refresh_tokens.revoked_at = now()` (เฉพาะ session ปัจจุบัน)
4. ตอบ 204 No Content
5. Frontend: ลบ tokens, redirect ไปหน้า login

**หมายเหตุ:** access token ที่หมดอายุ 15 นาทีจะหมดไปเอง JWT ไม่มี revocation list ใน MVP

---

## 6. Onboarding — สร้างธุรกิจแรก

**Trigger:** Login สำเร็จครั้งแรก + ยังไม่มี business → redirect ไป onboarding

### Step 1: สร้างธุรกิจ

**UI:**
```
┌────────────────────────────────────┐
│ ยินดีต้อนรับ! มาเริ่มต้นกันเลย       │
│ สร้างธุรกิจแรกของคุณ                  │
│                                    │
│ ชื่อธุรกิจ*:        [_________]    │
│ อุตสาหกรรม*:        [▼ เลือก]      │
│ คำอธิบาย:            [_________]    │
│ กลุ่มเป้าหมาย:       [_________]    │
│ โทนเสียงแบรนด์:      [▼ เลือก]      │
│ คำสำคัญ:             [tag, tag+]   │
│                                    │
│ โลโก้ (ไม่บังคับ):    [อัปโหลด]      │
│                                    │
│ [ ถัดไป: ตั้งค่าการโพสต์อัตโนมัติ ]   │
└────────────────────────────────────┘
```

**Flow:**
1. User กรอกข้อมูล + (optional) อัปโหลดโลโก้
2. Frontend เรียก `POST /businesses` (multipart/form-data)
3. Backend:
   - Validate
   - INSERT `businesses`
   - ถ้ามี logo → INSERT `files` (kind='logo') → UPDATE `businesses.logo_file_id`
   - ตอบ 201 { business }

### Step 2: ตั้งค่าการโพสต์อัตโนมัติ

**UI:**
```
┌────────────────────────────────────┐
│ ตั้งค่าการโพสต์อัตโนมัติ              │
│                                    │
│ ☑ เปิดใช้งานโพสต์อัตโนมัติ           │
│                                    │
│ โหมด:                               │
│  ◉ AI ตัดสินใจเอง (แนะนำ)            │
│  ○ กำหนดตารางเอง                     │
│                                    │
│ เป้าหมวนโพสต์ต่อสัปดาห์:              │
│  [ 3 ] โพสต์                        │
│                                    │
│ ระยะห่างขั้นต่ำระหว่างโพสต์:        │
│  [ 1 ] วัน                         │
│                                    │
│ [ ถัดไป: เพิ่มบริการ/สินค้า ]        │
└────────────────────────────────────┘
```

**Flow:**
1. User ตั้งค่า cadence (โหมด, จำนวนต่อสัปดาห์, min gap)
2. Frontend เรียก `PATCH /businesses/{id}/auto-post { enabled, mode, postsPerWeekTarget, minGapDays, fixedScheduleRules? }`
3. Backend UPDATE `businesses`

### Step 3: เพิ่มบริการ/สินค้า (อย่างน้อย 1 รายการ)

**UI:**
```
┌────────────────────────────────────┐
│ เพิ่มบริการ/สินค้า                   │
│                                    │
│ ┌──────────────────────────┐      │
│ │ ก๋วยเตี๋ยวต้มยำ            │      │
│ │ ต้มยำรสจัด เส้นเหนียวนุ่ม    │      │
│ │ ฿60  [แก้ไข] [ลบ]           │      │
│ └──────────────────────────┘      │
│                                    │
│ [ + เพิ่มบริการ ]                    │
│                                    │
│ [ ถัดไป: เชื่อมต่อ Facebook ]       │
└────────────────────────────────────┘

Modal เพิ่มบริการ:
ชื่อ:        [_________]
คำอธิบาย:    [_________]
ราคา (บาท):  [______]
รูปภาพ:      [อัปโหลด] (ไม่บังคับ)
[ บันทึก ]
```

**Flow:**
1. User เพิ่มบริการ 1+ รายการ
2. Frontend เรียก `POST /businesses/{id}/services` (multipart ถ้ามีรูป)
3. Backend INSERT `services` (+ INSERT `files` ถ้ามีรูป)

### Step 4: เชื่อมต่อ Facebook Page

**UI หน้าแรก:**
```
┌────────────────────────────────────┐
│ เชื่อมต่อ Facebook Page             │
│                                    │
│ เราจะใช้ Facebook เพื่อโพสต์ให้คุณ   │
│                                    │
│ [ เชื่อมต่อกับ Facebook ]           │
│                                    │
│ ── หรือ ──                          │
│ [ ข้ามไปก่อน ทำภายหลังได้ ]         │
└────────────────────────────────────┘
```

**Flow เชื่อมต่อ:**
1. Frontend → Backend: `GET /facebook/oauth/start?businessId={id}` → 302 redirect
2. Backend redirect ไป Facebook OAuth
3. User login + authorize บน Facebook
4. Facebook redirect กลับ → `GET /facebook/oauth/callback?code=xxx&state=xxx`
5. Backend:
   - Verify state (signed JWT)
   - Exchange code → user access_token
   - `GET /me/accounts` → list pages
6. Frontend แสดงหน้าเลือก page:

```
┌────────────────────────────────────┐
│ เลือก Facebook Page ที่ต้องการโพสต์   │
│                                    │
│ ◉ ร้านก๋วยเตี๋ยวลุงมา (Official)     │
│ ○ ลุงมา คาเฟ่                      │
│                                    │
│ [ ยืนยัน ]                          │
└────────────────────────────────────┘
```

7. Frontend → Backend: `POST /facebook/pages/select { businessId, fbPageId }`
8. Backend:
   - แลก user token → page token (long-lived, ~60 วัน)
   - เข้ารหัส AES-GCM → INSERT `facebook_pages` (access_token_encrypted, token_expires_at)
   - ตอบ 201

**สิ้นสุด Onboarding** → redirect ไป Dashboard

---

## 7. Dashboard หลัก

```
┌────────────────────────────────────────────────┐
│ 🏪 ร้านก๋วยเตี๋ยวลุงมา  [▼ เปลี่ยนธุรกิจ]        │
│ ────────────────────────────────────────────── │
│ โพสต์อัตโนมัติ: ✅ เปิด (AI ตัดสินใจ)  [ตั้งค่า] │
│                                                │
│ ⏰ โพสต์ถัดไป (รออนุมัติ)                       │
│ ┌──────────────────────────────────────────┐  │
│ │ 📅 วันนี้ 18:00  • โปรโมชัน              │  │
│ │ "ศุกร์นี้พบกับโปรโปรโมชันสุดคุ้ม..."     │  │
│ │ 🖼 [รูป]                                  │  │
│ │ [ดู] [อนุมัติ] [ปฏิเสธ]                   │  │
│ └──────────────────────────────────────────┘  │
│                                                │
│ 📊 สถิติ: สัปดาห์นี้ 2/3 โพสต์  |  ทั้งหมด 47 │
│                                                │
│ [ + สร้างโพสต์ด้วยตนเอง ]                       │
└────────────────────────────────────────────────┘
```

### Sections

| Section | API |
|---|---|
| Header (ชื่อธุรกิจ, สถานะ auto-post) | `GET /businesses/{id}` |
| โพสต์ถัดไป (รออนุมัติ) | `GET /businesses/{id}/posts?status=pending_approval` |
| โพสต์ที่กำลังจะถึงกำหนด | `GET /businesses/{id}/posts?status=approved&upcoming=true` |
| โพสต์ที่ผ่านมา (ย่อ) | `GET /businesses/{id}/posts?status=posted&limit=5` |
| สถิติ | คำนวณจาก `GET /businesses/{id}/posts?from=...&to=...` |

### ปุ่มต่างๆ

- **เปลี่ยนธุรกิจ** → dropdown เลือก (ถ้ามีหลายธุรกิจ)
- **ตั้งค่า** (auto-post) → เปิด modal แก้ cadence
- **ดู/อนุมัติ/ปฏิเสธ** (โพสต์) → ไปหน้า Post detail
- **สร้างโพสต์ด้วยตนเอง** → เปิด flow สร้าง manual post (ดูหัวข้อ 9)

---

## 8. Daily AI Pipeline (Flow หลัก 06:00 น.) — Flow อัตโนมัติ

> นี่คือ flow หลักที่ user จะเจอบ่อยที่สุด ทำงานอัตโนมัติทุกวัน

### Timeline ของวันหนึ่งๆ

```
06:00 ─── AI Decision: "วันนี้ควรโพสต์ไหม?"
06:00–06:30 ── Generation: สร้าง caption + สร้างรูป/คลิป
06:30 ─── Email: "โพสต์พร้อมตรวจสอบ" ส่งถึง user
06:30–17:59 ── รอ user ตัดสินใจ (approve / reject / ไม่ทำอะไร)
18:00 ─── Dispatch: โพสต์ลง Facebook (ถ้า approved)
```

### 8.1 เวลา 06:00 น. — Cron `daily-decide`

```
Backend (cron):
1. SELECT * FROM businesses
   WHERE auto_post_enabled = true
     AND mode = 'ai_decide'
     AND deleted_at IS NULL
2. สำหรับแต่ละธุรกิจ:
   - SELECT recent posts (14 วันล่าสุด)
   - นับ postsThisWeek
   - หา lastPostAt
3. POST /decide → AI Decision Service
4. INSERT content_plans
5. รอ callback (async)
```

### 8.2 AI Decision Service ตอบกลับ

- **ถ้า `shouldPost: false`** → log "วันนี้ข้าม" → จบ
- **ถ้า `shouldPost: true`**:
  - INSERT `posts` (status = `generating`, scheduled_at = suggested time, approval_deadline = scheduled_at)
  - INSERT `ai_jobs` (caption, image หรือ short_video)
  - Enqueue jobs → Backend เรียก AI services (caption + media)

### 8.3 เวลา 06:00–06:30 — Generation (parallel)

```
Backend → AI Caption:   POST /generate { context }
AI Caption → POST /internal/ai/caption/callback { caption }

Backend → AI Media:     POST /generate/image (หรือ /short_video)
                        { context, upload.presignedUrl }
AI Media:
  1. สร้าง image/video
  2. PUT ไป presigned URL → MinIO
  3. POST /internal/ai/{image|short_video}/callback { storageKey, publicUrl, ... }

Backend (เมื่อครบ):
  - UPDATE posts.caption
  - INSERT post_media
  - UPDATE posts.status = 'pending_approval'
  - Enqueue email "post พร้อมตรวจสอบ"
```

### 8.4 เวลา 06:30 — Email ส่งถึง User

```
อีเมล:
┌────────────────────────────────────────────┐
│ โพสต์ใหม่พร้อมตรวจสอบ — ร้านก๋วยเตี๋ยวลุงมา  │
│ ────────────────────────────────────────── │
│ AI แนะนำให้โพสต์วันนี้ เวลา 18:00 น.         │
│                                            │
│ [รูป]                                       │
│                                            │
│ "ศุกร์นี้พบกับโปรโปรโมชันสุดคุ้ม!           │
│  ก๋วยเตี๋ยวต้มยำรสจัด เพียง 60 บาท..."     │
│                                            │
│ [ ดูและอนุมัติ ]                            │
│                                            │
│ ── หากไม่อนุมัติภายใน 18:00 ระบบจะข้ามโพสต์นี้ ──
└────────────────────────────────────────────┘
```

### 8.5 User คลิก → หน้า Post Detail

```
┌────────────────────────────────────────────┐
│ โพสต์ที่จะเผยแพร่ 27 มิ.ย. 2569 เวลา 18:00 │
│ ────────────────────────────────────────── │
│                                            │
│ [รูป/คลิป]                                  │
│                                            │
│ แคปชั่น:                                    │
│ ┌────────────────────────────────────┐    │
│ │ ศุกร์นี้พบกับโปรโปรโมชันสุดคุ้ม!    │    │
│ │ ก๋วยเตี๋ยวต้มยำรสจัด เพียง 60 บาท  │    │
│ │ ...                                │    │
│ └────────────────────────────────────┘    │
│ [✏️ แก้ไข]                                  │
│                                            │
│ เวลาโพสต์: 27 มิ.ย. 2569 18:00 น.          │
│ [✏️ เปลี่ยนเวลา]                              │
│                                            │
│ เหตุผลจาก AI: "โพสต์ 2 ครั้งในสัปดาห์นี้     │
│ ห่างจากโพสต์ล่าสุด 3 วัน ควรโพสต์วันนี้"     │
│                                            │
│ [ ✓ อนุมัติ ]  [ ✕ ปฏิเสธ ]                 │
│                                            │
│ ⏰ หากไม่ดำเนินการภายใน 18:00               │
│    ระบบจะข้ามโพสต์นี้อัตโนมัติ                │
└────────────────────────────────────────────┘
```

### 8.6 ทางเลือก A: User อนุมัติ (Approve)

1. ไม่แก้ไข → `POST /posts/{id}/approve` → status = `approved`
2. แก้ caption → modal แก้ → `POST /posts/{id}/approve { caption }`
3. แก้เวลา → date/time picker → `POST /posts/{id}/approve { scheduledAt }`
4. แก้ทั้งคู่ → `POST /posts/{id}/approve { caption, scheduledAt }`

**Backend validate:**
- `scheduledAt` ต้องอยู่ในอนาคต
- `scheduledAt` ต้องไม่ชนกับ post อื่นในช่วง ±5 นาที (optional)
- status ปัจจุบันต้องเป็น `pending_approval` (ถ้าไม่ใช่ → 409 `invalid_state`)

**UI แสดง:** "อนุมัติแล้ว จะโพสต์เวลา XX:XX"

### 8.7 ทางเลือก B: User ปฏิเสธ (Reject)

```
Modal:
เหตุผลในการปฏิเสธ (ไม่บังคับ):
[_____________________]
[ ยืนยันปฏิเสธ ]
```

- `POST /posts/{id}/reject` { reason? }
- Backend: UPDATE status = `rejected`, rejection_reason = 'user_rejected'
- UI แสดง "ปฏิเสธแล้ว จะไม่โพสต์วันนี้"

### 8.8 ทางเลือก C: User ไม่ทำอะไร (Auto-Reject)

- เวลา `scheduled_at` ผ่านไป
- Cron `expire-pending-approvals` (ทุก 1 นาที) ทำงาน:
  - `SELECT * FROM posts WHERE status = 'pending_approval' AND scheduled_at <= now()`
  - UPDATE status = `expired`, rejection_reason = 'timeout'
- Email "โพสต์ถูกข้ามเนื่องจากไม่ได้รับการอนุมัติทันเวลา"

### 8.9 เวลา `scheduled_at` — Dispatch

- Cron `dispatch-due-posts` (ทุก 1 นาที):
  - `SELECT * FROM posts WHERE status = 'approved' AND scheduled_at <= now()`
  - สำหรับแต่ละ post:
    - POST ไป Facebook Graph API
    - สำเร็จ → status = `posted`, posted_at = now(), บันทึก fb_post_id
    - ส่ง email "โพสต์เผยแพร่แล้ว"
    - ล้มเหลว → retry (3 ครั้ง, exp backoff) → ถ้าครบ → `failed` + email

---

## 9. Manual Post (สร้างโพสต์ด้วยตนเอง)

**Trigger:** User คลิกปุ่ม "+ สร้างโพสต์ด้วยตนเอง" (ใช้ได้เสมอ แม้ auto-post ปิด)

### UI

```
┌────────────────────────────────────┐
│ สร้างโพสต์ใหม่                      │
│ ─────────                          │
│                                    │
│ ประเภทโพสต์:                        │
│  ◉ โปรโมชัน                         │
│  ○ แสดงสินค้า                       │
│  ○ สร้างการรับรู้แบรนด์              │
│  ○ อีเวนต์                          │
│  ○ ให้ AI เลือก                     │
│                                    │
│ บริการ/สินค้าที่ต้องการนำเสนอ:      │
│  ☑ ก๋วยเตี๋ยวต้มยำ                  │
│  ☐ ข้าวผัดปู                       │
│  ☑ น้ำมะนาว                        │
│                                    │
│ คำแนะนำเพิ่มเติม (ไม่บังคับ):        │
│ [ เน้นโปรโมชันวันศุกร์...      ]    │
│                                    │
│ เวลาโพสต์:                          │
│  ◉ ช่วงเวลาว่างถัดไปที่ AI แนะนำ     │
│  ○ เลือกเอง: [📅 __/__/____ ⏰ __:__]│
│                                    │
│ [ สร้างโพสต์ ]                      │
└────────────────────────────────────┘
```

### Flow

1. User กรอกแบบฟอร์ม
2. Frontend เรียก `POST /posts` { businessId, postType, featuredServiceIds, captionHint, scheduleAt? }
3. Backend:
   - Validate
   - ถ้าไม่ระบุ `scheduleAt` → เรียก AI Decision Service เฉพาะเพื่อ "เลือกเวลา" (sub-flow)
   - INSERT `posts` (status = `generating`, generation_source = 'manual')
   - INSERT `ai_jobs` (caption, image/short_video)
   - Enqueue jobs
4. หลัง generate เสร็จ → email "post พร้อมตรวจสอบ" → flow เหมือนขั้น 8.5–8.9

**ต่างจาก auto:**
- ไม่มี "AI Decision" (user เป็นคนสั่งเอง) — ยกเว้นกรณีเลือกเวลาให้ AI เลือก
- `generation_source = 'manual'`
- ปุ่ม "สร้างโพสต์" ใช้ได้แม้ `auto_post_enabled = false`

---

## 10. โหมด Fixed Schedule (ทางเลือกแทน AI Decide)

**Setup:** ตอนตั้งค่า auto-post เลือก "กำหนดตารางเอง"

### UI ตั้งค่า

```
┌────────────────────────────────────┐
│ ตั้งค่าการโพสต์อัตโนมัติ              │
│                                    │
│ โหมด:                               │
│  ○ AI ตัดสินใจเอง                    │
│  ◉ กำหนดตารางเอง                     │
│                                    │
│ ตาราง:                               │
│ ┌──────────────────────────────┐  │
│ │ จันทร์    [▼ เช้า] [10:00]    │  │
│ │ พฤหัสบดี [▼ เย็น] [19:00]    │  │
│ │ [+ เพิ่มวัน]                  │  │
│ └──────────────────────────────┘  │
│                                    │
│ [ บันทึก ]                          │
└────────────────────────────────────┘
```

### Flow

- Cron `materialize-fixed-schedule` (ทุก 1 ชั่วโมง) สร้าง content_plans ล่วงหน้า 7 วัน
- สำหรับแต่ละ rule → สร้าง plan (decided_by='ai' แต่ window = fixed)
- เรียก AI Decision Service เพื่อเลือก postType, featured services, caption hint เท่านั้น (ไม่ตัดสินว่าจะโพสต์หรือไม่ — เพราะ fixed ไว้แล้ว)
- จากนั้น flow เหมือน auto (generation → approval → dispatch)

**ข้อแตกต่างจาก AI Decide:**
- ไม่มี auto-reject (เพราะเป็นตามตารางที่ user ตั้ง)
- แต่ user ยังสามารถ reject เองได้ที่หน้า Post detail

---

## 11. จัดการบัญชี / ตั้งค่า

### 11.1 ตั้งค่าธุรกิจ

| Action | API |
|---|---|
| แก้ชื่อ, อุตสาหกรรม, คำอธิบาย, โทน, target_audience, keywords | `PATCH /businesses/{id}` |
| เปลี่ยนโลโก้ | `PUT /businesses/{id}/logo` (multipart) |
| เปลี่ยน auto-post config | `PATCH /businesses/{id}/auto-post` |
| ลบธุรกิจ (soft delete) | `DELETE /businesses/{id}` (ต้องยืนยัน) |

### 11.2 จัดการบริการ/สินค้า

| Action | API |
|---|---|
| ดูรายการ | `GET /businesses/{id}/services` |
| เพิ่ม | `POST /businesses/{id}/services` |
| แก้ไข | `PATCH /services/{id}` |
| เปิด/ปิด | `PATCH /services/{id}` { isActive } |
| ลบ (soft) | `DELETE /services/{id}` |

### 11.3 จัดการ Facebook

| Action | API |
|---|---|
| ดูเพจที่เชื่อมต่อ | `GET /facebook/pages?businessId=xxx` |
| เชื่อมต่อใหม่ | (ผ่าน OAuth flow เหมือน onboarding) |
| เปลี่ยนเพจ | ยกเลิกของเดิม + เชื่อมต่อใหม่ |
| ยกเลิกการเชื่อมต่อ | `DELETE /facebook/pages/{id}` |

### 11.4 ประวัติโพสต์

```
┌────────────────────────────────────┐
│ ประวัติโพสต์                        │
│ ────────                            │
│ กรอง: [▼ ทั้งหมด] [▼ เดือนนี้]     │
│ สถานะ: [✓ เผยแพร่แล้ว]              │
│       [ ] รออนุมัติ                 │
│       [ ] ข้าม/หมดเวลา              │
│       [ ] ล้มเหลว                   │
│                                    │
│ ┌────────────────────────────┐    │
│ │ 27 มิ.ย. 18:00  โปรโมชัน   │    │
│ │ ✅ เผยแพร่แล้ว  [ดู]        │    │
│ ├────────────────────────────┤    │
│ │ 25 มิ.ย. 14:00  สินค้า     │    │
│ │ ⏰ หมดเวลา (ไม่ได้อนุมัติ) │    │
│ │ [ดู]                       │    │
│ └────────────────────────────┘    │
│                                    │
│ [< 1 2 3 ... >]                    │
└────────────────────────────────────┘
```

- `GET /posts?businessId=xxx&status=posted&page=1&limit=20`
- Response: `{ posts: [...], total, page, limit }`

### 11.5 ตั้งค่าบัญชีผู้ใช้

| Action | API |
|---|---|
| เปลี่ยนรหัสผ่าน | `POST /auth/change-password` (ต้องใส่รหัสเดิม) |
| ลบบัญชี | `DELETE /me` (ยืนยัน → soft delete user + revoke tokens) |

---

## ตาราง Email ทั้งหมดที่ User จะได้รับ

| # | Trigger | Template | เนื้อหา |
|---|---|---|---|
| 1 | สมัครสมาชิก | `verify-email` | ปุ่มยืนยันอีเมล (link หมดอายุ 24h) |
| 2 | ลืมรหัสผ่าน | `reset-password` | ลิงก์รีเซ็ต (link หมดอายุ 1h) |
| 3 | Generate เสร็จ (auto) | `post-ready` | รูป/คลิป + caption + เวลา + ปุ่มอนุมัติ/ปฏิเสธ |
| 4 | Generate เสร็จ (manual) | `post-ready` | เหมือนกัน |
| 5 | Auto-reject (timeout) | `post-expired` | แจ้งว่าโพสต์ถูกข้ามเพราะไม่อนุมัติทันเวลา |
| 6 | โพสต์สำเร็จ | `post-posted` | ลิงก์ไป Facebook post |
| 7 | โพสต์ล้มเหลว (3 ครั้ง) | `post-failed` | รายละเอียด error + ลิงก์ post detail |

**ทุก email มี footer "ยกเลิกการรับการแจ้งเตือน" (transactional emails จะยกเลิกไม่ได้ใน MVP ยกเว้น marketing)**

---

## สรุป Roles / Permissions

| Action | Owner | Other user |
|---|---|---|
| ดูธุรกิจตัวเอง | ✅ | ❌ |
| แก้ธุรกิจ | ✅ | ❌ |
| โพสต์/อนุมัติ/ปฏิเสธ | ✅ | ❌ |
| เชื่อมต่อ/ยกเลิก Facebook | ✅ | ❌ |
| เพิ่ม/แก้/ลบ บริการ-สินค้า | ✅ | ❌ |
| ดูประวัติโพสต์ | ✅ | ❌ |

**MVP: 1 user = 1 หรือหลายธุรกิจ (แต่ละธุรกิจมี owner เดียว)**
**ไม่มี team/collaborator/multi-user ในธุรกิจ** (อาจเพิ่มในอนาคต)
