# 01. ภาพรวมระบบ (System Overview)

> เอกสารนี้อธิบายภาพรวมสถาปัตยกรรม เทคโนโลยี บทบาท และความรับผิดชอบของแต่ละส่วน

---

## 1. เป้าหมายของระบบ

แพลตฟอร์มการตลาดบน Facebook ที่ขับเคลื่อนด้วย AI สำหรับวิสาหกิจขนาดกลางและขนาดย่อม (SMEs) ในไทย — ผู้ใช้สมัคร สร้างธุรกิจ แล้วให้ AI ตัดสินใจสร้างและจัดตารางโพสต์ให้อัตโนมัติ พร้อมรอการอนุมัติจากผู้ใช้ก่อนเผยแพร่จริง

**คุณค่าหลัก:** ลดภาระของ SMEs ในการสร้างเนื้อหาและจัดตารางโพสต์ โดยยังให้ผู้ใช้ควบคุมขั้นสุดท้ายได้

---

## 2. สถาปัตยกรรม (High-Level)

```
┌──────────┐      ┌──────────────────┐      ┌─────────────────┐
│ Frontend │─────▶│  Backend (NestJS)│─────▶│  PostgreSQL 15  │
│ Next.js  │◀─────│   (this repo)    │◀─────│  + TypeORM      │
└──────────┘      └────────┬─────────┘      └─────────────────┘
                           │
                ┌──────────┼──────────┬─────────────┐
                ▼          ▼          ▼             ▼
           ┌────────┐  ┌──────┐  ┌──────┐     ┌──────────┐
           │ Redis  │  │MinIO │  │Mailhog│     │  Facebook│
           │BullMQ  │  │ S3   │  │ SMTP  │     │ Graph API│
           └────────┘  └──────┘  └──────┘     └──────────┘
                ▲          ▲
                │          │
       ┌────────┴───┐ ┌────┴────────────┐ ┌──────────────────┐
       │ AI Decision│ │ AI Caption Svc  │ │ AI Media Svc     │
       │  (external)│ │  (external)     │ │ (image+video)    │
       └────────────┘ └─────────────────┘ └──────────────────┘
            (ทีมงานอื่นเป็นเจ้าของ — Backend เป็นผู้เรียกผ่าน HTTP)
```

**Backend เป็น Orchestrator** — ทุกอย่างวิ่งผ่าน Backend:
- เก็บข้อมูลทั้งหมดใน PostgreSQL
- จัดคิวงานใน Redis (BullMQ)
- จัดเก็บไฟล์ใน MinIO (S3-compatible)
- ส่งอีเมลผ่าน Mailhog (dev) / SMTP จริง (prod)
- โพสต์ไป Facebook Graph API
- เรียก AI services ผ่าน HTTP POST/Callback

---

## 3. เทคโนโลยี (Tech Stack)

| Layer | เทคโนโลยี |
|---|---|
| ภาษา | TypeScript |
| Backend Framework | NestJS 11 |
| ORM | TypeORM |
| ฐานข้อมูล | PostgreSQL 15 |
| Queue / Cron | BullMQ + Redis 7 |
| File Storage | MinIO (S3-compatible) |
| Email (dev) | Mailhog (SMTP) |
| Email (prod) | SMTP provider (เช่น SendGrid, AWS SES) |
| Authentication | JWT (access 15 นาที + refresh 7 วัน) |
| Validation | class-validator + class-transformer |
| Logging | pino (structured JSON) |
| Testing | Jest |
| Frontend | Next.js (App Router) + TypeScript + React 19 |

---

## 4. บทบาทและความรับผิดชอบ (Team & Responsibilities)

### 4.1 Backend dev (ทีมของเรา)

**รับผิดชอบ:**
- NestJS API ทั้งหมด
- PostgreSQL schema + migrations
- BullMQ queues + processors
- Cron jobs
- MinIO (presigned URL)
- Facebook OAuth + Graph API
- AI service contracts (HTTP + callbacks)
- Email templates
- Observability (logging, /health, Bull Board)
- Auth (JWT, internal token)

**Repository:** `backend/server/`

### 4.2 AI Marketing dev (ทีมอื่น)

**รับผิดชอบ:**
- **AI Decision Service** — ตัดสินใจว่าจะโพสต์วันนี้ไหม + เลือกเวลา/ประเภท
- **AI Caption Service** — สร้างแคปชั่นภาษาไทย

**Contract ที่ต้องอ่าน:**
- [`contracts/AI-DECISION.md`](./contracts/AI-DECISION.md)
- [`contracts/AI-CAPTION.md`](./contracts/AI-CAPTION.md)

### 4.3 AI Media dev (ทีมอื่น)

**รับผิดชอบ:**
- **AI Media Service** — สร้าง image และ short_video (≤ 15 วินาที)

**Contract ที่ต้องอ่าน:**
- [`contracts/AI-MEDIA.md`](./contracts/AI-MEDIA.md)

### 4.4 Frontend dev

**รับผิดชอบ:**
- Next.js app
- ทุก UI ตาม [`userflow.md`](../userflow.md)

**Contract ที่ต้องอ่าน:**
- [`contracts/FRONTEND.md`](./contracts/FRONTEND.md)
- [`API.md`](../API.md)
- [`userflow.md`](../userflow.md)

---

## 5. โครงสร้าง Backend (Module Layout)

```
backend/server/src/
├── main.ts                          # bootstrap
├── app.module.ts                    # root module
├── config/                          # env loaders
│   ├── env.config.ts
│   ├── database.config.ts
│   ├── redis.config.ts
│   ├── s3.config.ts
│   └── mail.config.ts
│
├── database/
│   ├── data-source.ts               # TypeORM DataSource
│   ├── migrations/                  # SQL migrations
│   └── entities/                    # TypeORM entities
│
├── common/
│   ├── guards/                      # JwtAuthGuard, InternalTokenGuard, OwnerGuard, EmailVerifiedGuard
│   ├── decorators/                  # @CurrentUser, @Public, @IdempotencyKey
│   ├── filters/                     # AllExceptionsFilter
│   ├── interceptors/                # RequestIdInterceptor, LoggingInterceptor
│   └── pipes/                       # ZodValidationPipe
│
├── modules/
│   ├── auth/                        # register, login, refresh, logout, forgot/reset password
│   ├── users/                       # getMe, changePassword
│   ├── businesses/                  # CRUD + auto-post config
│   ├── services/                    # product/service catalog
│   ├── files/                       # upload, presigned URL
│   ├── facebook/                    # OAuth, pages, graph
│   ├── ai/                          # /internal/ai/* callbacks
│   ├── posts/                       # state machine, approve/reject
│   ├── notifications/
│   └── email/
│
├── jobs/                            # BullMQ processors
│   ├── queues.ts
│   └── processors/
│       ├── caption.processor.ts
│       ├── media.processor.ts
│       ├── dispatch-post.processor.ts
│       ├── email.processor.ts
│       └── refresh-token.processor.ts
│
├── scheduler/                       # @nestjs/schedule crons
│   ├── daily-decide.cron.ts                 # 06:00 ทุกวัน
│   ├── materialize-fixed-schedule.cron.ts   # ทุก 1 ชม.
│   ├── dispatch-due-posts.cron.ts           # ทุก 1 นาที
│   ├── expire-pending-approvals.cron.ts     # ทุก 1 นาที
│   ├── ai-job-retry.cron.ts                 # ทุก 30 วินาที
│   ├── fb-token-refresh.cron.ts             # ทุกวัน
│   ├── cleanup-orphan-files.cron.ts         # ทุกวัน
│   └── drain-email-queue.cron.ts            # ทุก 1 นาที
│
└── health/                          # /health endpoint
```

---

## 6. Flow หลัก (Daily AI Pipeline)

```
06:00  ── daily-decide cron
          ↓
       AI Decision Service → shouldPost? (true/false)
          ↓ (true)
       สร้าง posts row (status = 'generating')
          ↓
       Enqueue jobs: caption + media (image/video)
          ↓
06:00–06:30 ── Generation
          ↓
       AI Caption Service → caption
       AI Media Service → image/video (อัปโหลดผ่าน presigned URL)
          ↓
       posts.status = 'pending_approval'
       Email: "โพสต์พร้อมตรวจสอบ"
          ↓
06:30–17:59 ── รอ user
          ↓
       ┌─── User approve (optionally แก้ caption/time) → status = 'approved'
       ├─── User reject → status = 'rejected'
       └─── ไม่ทำอะไร → cron expire → status = 'expired'
          ↓
18:00  ── dispatch-due-posts cron (ถ้า approved)
          ↓
       Facebook Graph API → posted
          ↓
       Email: "โพสต์เผยแพร่แล้ว"
```

---

## 7. Cron Jobs ทั้งหมด

| Cron | ตารางเวลา | หน้าที่ |
|---|---|---|
| `daily-decide` | 06:00 น. ทุกวัน | ส่งงาน "ตัดสินใจ" ไป AI Decision Service |
| `materialize-fixed-schedule` | ทุก 1 ชั่วโมง | สร้าง content_plans จาก fixed_schedule_rules (ล่วงหน้า 7 วัน) |
| `dispatch-due-posts` | ทุก 1 นาที | โพสต์ที่ approved + ถึงเวลา → Facebook |
| `expire-pending-approvals` | ทุก 1 นาที | mark posts เป็น `expired` เมื่อ scheduled_at < now |
| `ai-job-retry` | ทุก 30 วินาที | retry AI jobs ที่ล้มเหลว |
| `fb-token-refresh` | ทุกวัน | ต่ออายุ Facebook token ที่เหลือน้อยกว่า 7 วัน |
| `cleanup-orphan-files` | ทุกวัน | ลบไฟล์ที่ไม่มี reference |
| `drain-email-queue` | ทุก 1 นาที | ส่งอีเมลค้างในคิว |

ดูรายละเอียด: [`docs/03-POST-LIFECYCLE.md`](./03-POST-LIFECYCLE.md)

---

## 8. ขอบเขต MVP (Phase P0–P3)

| Phase | ขอบเขต | สถานะ |
|---|---|---|
| **P0** | Authentication, Business, Logo, File storage | ⏳ |
| **P1** | Facebook OAuth, เชื่อมต่อเพจ, โพสต์ด้วยตนเอง (ไม่มี AI) | ⏳ |
| **P2** | AI Caption + AI Media, ขั้นตอนอนุมัติ, อีเมล | ⏳ |
| **P3** | Daily AI decide, fixed schedule, cron dispatcher, auto-reject | ⏳ |
| **P4** | ตกแต่ง, error handling, observability, retry policy | ⏳ |

> หมายเหตุ: โปรเจกต์อยู่ระหว่างการพัฒนา (WIP) — ทุก phase ยังไม่เริ่ม

---

## 9. Non-Goals (สิ่งที่ไม่ทำใน MVP)

- ❌ Multi-user collaboration ในธุรกิจเดียว (เฉพาะ owner)
- ❌ Carousel (หลายภาพต่อโพสต์) — มีได้ 1 สื่อต่อโพสต์
- ❌ Image/Video regeneration ในแอป (ต้อง regenerate ทั้ง post)
- ❌ Multiple Facebook pages ต่อธุรกิจ (เลือกได้แค่ 1)
- ❌ Instagram / TikTok integration
- ❌ Push notification (เฉพาะ email ใน MVP)
- ❌ WebSocket real-time (ใช้ polling ใน MVP)
- ❌ Multi-language (เฉพาะไทย)
- ❌ Currency อื่นที่ไม่ใช่ THB

---

## 10. อ่านเพิ่มเติม

- [`02-DATA-MODEL.md`](./02-DATA-MODEL.md) — schema ฐานข้อมูล
- [`03-POST-LIFECYCLE.md`](./03-POST-LIFECYCLE.md) — state machine
- [`04-DAILY-DECISION.md`](./04-DAILY-DECISION.md) — กฎ AI Decision
- [`05-AUTO-REJECT.md`](./05-AUTO-REJECT.md) — flow auto-reject
- [`06-AUTH.md`](./06-AUTH.md) — authentication
- [`07-OBSERVABILITY.md`](./07-OBSERVABILITY.md) — logging + health

อัปเดตล่าสุด: 2026-06-27
