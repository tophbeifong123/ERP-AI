# Backend — ERP-AI API Server

NestJS 11 + TypeORM + PostgreSQL 15 + BullMQ + Redis 7 + MinIO

> **สถานะ:** อยู่ระหว่างการพัฒนา (WIP / MVP) — ยังไม่ได้ implement โค้ดจริง
> เอกสารฉบับเต็มภาษาไทยอยู่ที่ [`../../docs/`](../../docs/)

---

## 🏗️ สถาปัตยกรรม (Architecture)

```
┌──────────┐      ┌──────────────────┐      ┌─────────────────┐
│ Frontend │─────▶│  Backend (NestJS)│─────▶│  PostgreSQL 15  │
│ Next.js  │◀─────│   THIS SERVER    │◀─────│  + TypeORM      │
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
```

**Backend เป็น Orchestrator** — ทุกอย่างวิ่งผ่าน Backend:
- เก็บข้อมูลใน PostgreSQL
- จัดคิวงานใน Redis (BullMQ)
- จัดเก็บไฟล์ใน MinIO (S3-compatible)
- ส่งอีเมลผ่าน Mailhog (dev) / SMTP (prod)
- โพสต์ไป Facebook Graph API
- เรียก AI services ผ่าน HTTP POST + callback

---

## 🛠️ เทคโนโลยี

| Layer | เทคโนโลยี |
|---|---|
| ภาษา | TypeScript |
| Framework | NestJS 11 |
| ORM | TypeORM |
| ฐานข้อมูล | PostgreSQL 15 |
| Queue / Cron | BullMQ + Redis 7 |
| File Storage | MinIO (S3-compatible) |
| Email (dev) | Mailhog |
| Authentication | JWT (access 15 นาที + refresh 7 วัน) |
| Internal Auth | Shared secret (X-Internal-Token) |
| Validation | class-validator / class-transformer |
| Logging | pino (structured JSON) |
| Testing | Jest |

---

## 📚 เอกสารที่เกี่ยวข้อง

**เอกสารฉบับเต็ม (ภาษาไทย):** [`../../docs/`](../../docs/)

| เอกสาร | คำอธิบาย |
|---|---|
| [`../../docs/01-OVERVIEW.md`](../../docs/01-OVERVIEW.md) | ภาพรวมระบบ + module layout + crons |
| [`../../docs/02-DATA-MODEL.md`](../../docs/02-DATA-MODEL.md) | Schema + ER diagram + migrations |
| [`../../docs/03-POST-LIFECYCLE.md`](../../docs/03-POST-LIFECYCLE.md) | State machine + transitions |
| [`../../docs/04-DAILY-DECISION.md`](../../docs/04-DAILY-DECISION.md) | กฎ AI Decision |
| [`../../docs/05-AUTO-REJECT.md`](../../docs/05-AUTO-REJECT.md) | Flow auto-reject |
| [`../../docs/06-AUTH.md`](../../docs/06-AUTH.md) | JWT + internal token |
| [`../../docs/07-OBSERVABILITY.md`](../../docs/07-OBSERVABILITY.md) | Logging + health |
| [`../../docs/contracts/AI-DECISION.md`](../../docs/contracts/AI-DECISION.md) | Contract ทีม AI Decision |
| [`../../docs/contracts/AI-CAPTION.md`](../../docs/contracts/AI-CAPTION.md) | Contract ทีม AI Caption |
| [`../../docs/contracts/AI-MEDIA.md`](../../docs/contracts/AI-MEDIA.md) | Contract ทีม AI Media |
| [`../../API.md`](../../API.md) | API contract ฉบับเต็ม |

---

## 📂 โครงสร้าง (ตามแผน)

```
backend/server/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/                  (env, db, redis, s3, mail)
│   ├── database/
│   │   ├── data-source.ts
│   │   ├── migrations/          (timestamped forward-only)
│   │   └── entities/
│   ├── common/                  (guards, decorators, filters, interceptors)
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── businesses/
│   │   ├── services/            (product/service catalog)
│   │   ├── files/               (upload + presigned URL)
│   │   ├── facebook/            (OAuth + Graph API)
│   │   ├── ai/                  (/internal/ai/* callbacks)
│   │   ├── posts/               (state machine)
│   │   ├── notifications/
│   │   └── email/
│   ├── jobs/                    (BullMQ processors)
│   ├── scheduler/               (@nestjs/schedule crons)
│   └── health/                  (/health endpoint)
├── test/                        (e2e tests)
├── package.json
├── tsconfig.json
└── nest-cli.json
```

---

## ⏰ Cron Jobs

| Cron | ตารางเวลา | หน้าที่ |
|---|---|---|
| `daily-decide` | 06:00 น. ทุกวัน | AI Decision Service |
| `materialize-fixed-schedule` | ทุก 1 ชั่วโมง | สร้าง content_plans จาก fixed_schedule_rules |
| `dispatch-due-posts` | ทุก 1 นาที | โพสต์ที่ approved → Facebook |
| `expire-pending-approvals` | ทุก 1 นาที | mark `expired` เมื่อ approval_deadline < now |
| `ai-job-retry` | ทุก 30 วินาที | retry jobs ที่ล้มเหลว |
| `fb-token-refresh` | ทุกวัน | ต่ออายุ Facebook token |
| `cleanup-orphan-files` | ทุกวัน | ลบไฟล์ที่ไม่มี ref |
| `drain-email-queue` | ทุก 1 นาที | ส่งอีเมลค้างในคิว |

---

## 🚀 เริ่มต้นใช้งาน (Getting Started)

### Prerequisites

- Node.js (แนะนำ v20+)
- pnpm (แนะนำ) หรือ npm
- Docker + Docker Compose (สำหรับ PostgreSQL, Redis, MinIO, Mailhog)
- ดู `.env.example` สำหรับ env ที่ต้องตั้ง

### ติดตั้ง

```bash
# ติดตั้ง dependencies
pnpm install

# หรือ
npm install
```

### รัน Services ด้วย Docker (แนะนำ)

```bash
# จาก root ของ repo (ยังไม่มี docker-compose — จะเพิ่มใน Phase P0)
docker-compose up -d
```

Services ที่ต้องรัน:
- **PostgreSQL 15** — port 5432
- **Redis 7** — port 6379
- **MinIO** — port 9000 (API) + 9001 (console)
- **Mailhog** — port 1025 (SMTP) + 8025 (UI)

### ตั้งค่า Environment

สร้างไฟล์ `.env` (ดู `.env.example`):

```bash
# Database
DATABASE_URL=postgres://erp:erp@localhost:5432/erp_ai

# Redis
REDIS_URL=redis://localhost:6379

# MinIO / S3
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_POSTS=posts
S3_BUCKET_PUBLIC_URL=http://localhost:9000

# JWT
JWT_ACCESS_SECRET=change-me-in-prod
JWT_REFRESH_SECRET=change-me-in-prod

# Internal (AI services)
INTERNAL_API_KEY=change-me-in-prod

# Facebook
FB_APP_ID=...
FB_APP_SECRET=...
FB_REDIRECT_URI=http://localhost:3000/facebook/oauth/callback

# Email
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM="ERP-AI <noreply@example.com>"

# Encryption
FB_TOKEN_ENCRYPTION_KEY=<32-byte random, base64>

# AI Services
AI_DECISION_URL=https://ai-decision.example.com
AI_CAPTION_URL=https://ai-caption.example.com
AI_MEDIA_URL=https://ai-media.example.com

# App
APP_URL=http://localhost:3000
LOG_LEVEL=info
```

### รัน Migrations

```bash
pnpm migration:run
```

### รัน Development

```bash
pnpm start:dev
```

Backend จะรันที่ http://localhost:3000

### ทดสอบ

```bash
pnpm test           # unit tests
pnpm test:e2e       # e2e tests
pnpm test:cov       # coverage
```

---

## 📝 คำสั่ง (Scripts)

| คำสั่ง | คำอธิบาย |
|---|---|
| `pnpm build` | Build สำหรับ production |
| `pnpm start` | รัน (production) |
| `pnpm start:dev` | รันแบบ watch mode |
| `pnpm start:debug` | รันพร้อม debugger |
| `pnpm lint` | ESLint + auto-fix |
| `pnpm format` | Prettier |
| `pnpm test` | Jest unit tests |
| `pnpm test:e2e` | Jest e2e tests |
| `pnpm migration:generate` | Generate migration จาก entity changes |
| `pnpm migration:run` | รัน migrations |
| `pnpm migration:revert` | revert migration ล่าสุด |

---

## 🛣️ Roadmap

| Phase | ขอบเขต | สถานะ |
|---|---|---|
| **P0** | Auth + Business + Service + File storage | ⏳ |
| **P1** | Facebook OAuth + Manual post | ⏳ |
| **P2** | AI Caption + Media + Approval + Email | ⏳ |
| **P3** | Daily AI decide + Fixed schedule + Cron + Auto-reject | ⏳ |
| **P4** | Polish + Observability + Retry policy + Metrics | ⏳ |

---

## 📞 ติดต่อ

- **Owner:** [ชื่อทีม Backend]
- **Channel:** [Slack/Discord/etc.]
- **Issues:** [GitHub Issues URL]

อัปเดตล่าสุด: 2026-06-27
