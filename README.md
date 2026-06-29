# ERP-AI

แพลตฟอร์มการตลาดบน Facebook ที่ขับเคลื่อนด้วย AI สำหรับวิสาหกิจขนาดกลางและขนาดย่อม (SMEs) — ลงทะเบียน สร้างธุรกิจ แล้วให้ AI ตัดสินใจสร้างและจัดตารางโพสต์ให้ทุกวันเวลา 06:00 น. พร้อมรอการอนุมัติจากผู้ใช้ก่อนเผยแพร่จริง

> **สถานะ (มิถุนายน 2026):** ระบบหลักใช้งานได้จริงตามที่อธิบายในเอกสาร — ผู้ใช้สามารถสมัคร, สร้างธุรกิจ, เชื่อม Facebook Page, สร้างโพสต์ด้วย AI (เลือก image หรือ short_video), อนุมัติ และให้ cron โพสต์ขึ้น Facebook ได้ ฟีเจอร์ที่เหลือใน TODO ดูได้ที่ [docs/PROGRESS.md](./docs/PROGRESS.md)

---

## 🚀 โครงสร้างโปรเจกต์ (Project Structure)

โปรเจกต์นี้ถูกออกแบบในรูปแบบ Monorepo / Multi-service:

- **`frontend/`** — ส่วนเว็บแอปพลิเคชันสำหรับผู้ใช้ (Next.js 16 App Router, TypeScript, React 19, Tailwind v4)
- **`backend/server/`** — บริการ Backend API (NestJS, TypeORM, PostgreSQL, BullMQ + Redis, JWT auth, MinIO/S3)
- **`ai-services/`** — บริการ AI ภายใน (FastAPI + Groq) สำหรับ Decision + Caption — เปิดใช้งานจริงแล้ว
- **`n8n/`** — workflow เดียวที่ใช้สร้างสื่อภาพ/วิดีโอ (image ผ่าน Gemini/Nano Banana, short_video ผ่าน Veo 3.1) — ทำงานบน [n8n](https://n8n.io/) ที่ spawn ผ่าน Docker
- **`docs/`** — เอกสารทั้งหมด (ภาษาไทย) รวมถึง contract สำหรับทีม AI และ Frontend
- **`scripts/`** — utility scripts (เช่น `make_bucket_public.py` สำหรับ GCS)

---

## 📚 เอกสาร (Documentation)

เอกสารฉบับเต็มเป็น **ภาษาไทย** อยู่ใน [`docs/`](./docs/)

| เอกสาร | คำอธิบาย |
|---|---|
| [`userflow.md`](./userflow.md) | **ทุก flow ที่ผู้ใช้จะเจอ** ตั้งแต่สมัครจนใช้งาน (11 flows + email + permissions) |
| [`API.md`](./API.md) | API contract ฉบับเต็ม (ทุก endpoint, ทุก schema) |
| [`docs/00-INDEX.md`](./docs/00-INDEX.md) | สารบัญเอกสารทั้งหมด |
| [`docs/contracts/AI-DECISION.md`](./docs/contracts/AI-DECISION.md) | Contract สำหรับทีม **marketing-ai dev** (Decision) |
| [`docs/contracts/AI-CAPTION.md`](./docs/contracts/AI-CAPTION.md) | Contract สำหรับทีม **marketing-ai dev** (Caption) |
| [`docs/contracts/AI-MEDIA.md`](./docs/contracts/AI-MEDIA.md) | Contract สำหรับทีม **ai-generate-media dev** |
| [`docs/contracts/FRONTEND.md`](./docs/contracts/FRONTEND.md) | Contract สำหรับทีม **frontend dev** |

---

## 💻 ส่วนการแสดงผล (Frontend - Next.js)

### 🛠️ เทคโนโลยี
- **Framework:** [Next.js](https://nextjs.org/) (App Router, React 19)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4 ( Obsidian Dark & Indigo / Mint Premium Theme )
- **Typography:** Geist Sans / Geist Mono ( Clean & Premium Minimalist font )
- **Linting:** ESLint

### 📂 โครงสร้างส่วนหน้าบ้าน (Frontend Directory Structure)
```
frontend/
├── src/
│   ├── app/                    # Routing Layer (App Router)
│   │   ├── (auth)/             # ระบบสิทธิ์การใช้งาน (Login, Register, etc.)
│   │   ├── globals.css         # กำหนดตัวแปร CSS & นำเข้า Tailwind v4
│   │   ├── layout.tsx          # Root Layout (ติดตั้ง Toaster แจ้งเตือน)
│   │   └── page.tsx            # หน้าดักเส้นทางหลัก (Routing Gatekeeper)
│   ├── components/             # UI Presentation Components
│   │   ├── ui/                 # อะตอมคอมโพเนนต์พื้นฐานจาก shadcn/ui
│   │   ├── layouts/            # โครงสร้างแถบนำทาง (Sidebar, Navbar)
│   │   ├── shared/             # คอมโพเนนต์ใช้ร่วมกันทั่วไป (Countdown, Player)
│   │   └── features/           # คอมโพเนนต์เฉพาะทางธุรกิจ (เช่น ตารางโพสต์, ฟอร์มบริการ)
│   ├── core/                   # Domain & API Layer (Clean Architecture)
│   │   ├── services/           # apiClient.ts และ APIs บริการเรียกหลังบ้าน
│   │   ├── types/              # ไฟล์นิยามประเภทข้อมูล TypeScript (Interfaces/DTOs)
│   │   └── validations/        # ไฟล์ Zod validation schemas สำหรับตรวจสอบฟอร์ม
│   ├── hooks/                  # React Hooks & State Management
│   │   ├── store/              # Zustand client states (use-auth-store.ts)
│   │   └── queries/            # React Query server states (คิวรีแคชข้อมูลหลังบ้าน)
│   ├── lib/                    # Library & Helper Utilities (utils.ts, formatters)
├── public/                     # ไฟล์ Static
└── ...
```



### ⚙️ การเริ่มต้นใช้งานระบบ (Getting Started)

ระบบประกอบด้วย 3 ส่วนหลักที่ต้องเปิดใช้งานในการทดสอบระบบ:

#### 1. สตาร์ทฐานข้อมูลและบริการเสริม (ผ่าน Podman หรือ Docker)
รันบริการ PostgreSQL, Redis, MinIO และ Mailhog ค้างไว้เบื้องหลัง:
```bash
# ใช้ Podman Compose
podman compose up -d

# หรือใช้ Docker Compose
docker compose up -d
```

#### 2. รันเซิร์ฟเวอร์หลังบ้าน (Backend - NestJS)
เปิดหน้าต่าง Terminal ใหม่เพื่อเริ่มการทำงานของ API Server:
```bash
cd backend/server
copy .env.example .env    # ทำเฉพาะครั้งแรก
pnpm install
pnpm migration:run        # สั่งรัน Database Migrations (ทำเฉพาะครั้งแรก)
pnpm start:dev            # เริ่มระบบที่ http://localhost:3000
```

#### 3. รันเซิร์ฟเวอร์หน้าบ้าน (Frontend - Next.js)
เปิดหน้าต่าง Terminal ใหม่เพื่อรันแอปพลิเคชันส่วนหน้าตาเว็บ:
```bash
cd frontend
pnpm install
pnpm dev                  # เริ่มระบบที่ http://localhost:3001
```
เปิดเบราว์เซอร์ไปที่ [http://localhost:3001](http://localhost:3001) เพื่อใช้งานหน้าบ้านที่มีระบบดักกรองเส้นทางหลักและหน้าล็อกอิน/สมัครสมาชิก (Phase 1)


---

## 🏗️ ส่วน Backend (NestJS)

### 🛠️ เทคโนโลยี

| Layer | ทางเลือก |
|---|---|
| ภาษา | TypeScript |
| Framework | NestJS 11 |
| ORM | TypeORM |
| ฐานข้อมูล | PostgreSQL 15 |
| Queue / Cron | BullMQ + Redis 7 |
| File Storage | MinIO (S3-compatible) |
| Email (dev) | Mailhog (SMTP) |
| Authentication | JWT (access 15 นาที + refresh 7 วัน) |
| Internal Auth | Shared secret (X-Internal-Token) |
| Validation | class-validator / class-transformer |
| Logging | pino (structured JSON) |
| Testing | Jest |

### 👥 ทีมและบทบาท

| บทบาท | ผู้รับผิดชอบ | ขอบเขตงาน |
|---|---|---|
| Backend & DB | You | NestJS API, PostgreSQL, File Storage, Cron Jobs, Queues, Auth |
| AI Decision | Other dev | ตัดสินใจว่าจะโพสต์วันนี้ / เลือกเวลา / ประเภท / featured services |
| AI Caption | Other dev | สร้างแคปชั่นภาษาไทย |
| AI Media | Other dev | สร้างภาพ/วิดีโอสั้น (≤ 15 วินาที) ใช้ Presigned URL อัปโหลดเข้า MinIO |
| Frontend | TBD | UI ทั้งหมด |

**สัญญาการทำงานของ Backend:**
- ทุกวัน 06:00 น. → ส่งงาน "ตัดสินใจ" ไป AI Decision Service
- ถ้าตัดสินใจว่าควรโพสต์ → ประสาน AI Caption + AI Media (ผ่าน HTTP POST + callback)
- จัดเก็บผลลัพธ์ใน MinIO (ผ่าน Presigned URL)
- รอ callback, retry 3 ครั้ง, ล้มเหลว → mark `failed` + email
- ส่ง email "post ready" ให้ user ตรวจสอบ
- User approve / reject / ไม่ทำอะไร (auto-reject)
- Cron ทุก 1 นาที → dispatch โพสต์ที่ถึงเวลาไป Facebook Graph API

### 🗂️ โครงสร้าง Backend (ตามแผน)

```
backend/server/src/
├── main.ts
├── app.module.ts
├── config/                  (env, db, redis, s3, mail)
├── database/
│   ├── data-source.ts
│   ├── migrations/
│   └── entities/
├── common/                  (guards, decorators, filters, interceptors)
├── modules/
│   ├── auth/
│   ├── users/
│   ├── businesses/
│   ├── services/            (product/service catalog)
│   ├── files/               (upload + presigned URL)
│   ├── facebook/            (OAuth + Graph API)
│   ├── ai/                  (/internal/ai/* callbacks)
│   ├── posts/               (state machine)
│   ├── notifications/
│   └── email/
├── jobs/                    (BullMQ processors)
├── scheduler/               (@nestjs/schedule crons)
└── health/
```

---

## ✨ คุณสมบัติหลัก (Features)

### 1. การยืนยันตัวตนและจัดการผู้ใช้
- ลงทะเบียนด้วยอีเมลและรหัสผ่าน (argon2id) พร้อมยืนยันอีเมล
- เข้าสู่ระบบ (JWT access 15 นาที + refresh token 7 วัน)
- ลืมรหัสผ่าน / ตั้งรหัสผ่านใหม่ (token TTL 1 ชั่วโมง)
- เปลี่ยนรหัสผ่าน (ต้องใส่รหัสเดิม)
- ออกจากระบบ (revoke refresh token)
- ลบบัญชี (soft delete)

### 2. โปรไฟล์ธุรกิจและแบรนด์
- สร้างธุรกิจ (ชื่อ, อุตสาหกรรม, คำอธิบาย, กลุ่มเป้าหมาย, โทนเสียง, คำสำคัญ)
- **การตั้งค่าโพสต์อัตโนมัติ (custom cadence):**
  - `enabled`: เปิด / ปิด
  - `mode`: `ai_decide` (AI เลือกเวลา) หรือ `fixed_schedule` (ผู้ใช้กำหนดกฎ)
  - `postsPerWeekTarget`: 1-14 โพสต์/สัปดาห์
  - `minGapDays`: ระยะห่างขั้นต่ำ 0-7 วัน
  - `fixedScheduleRules`: `[{dayOfWeek: 1, time: "20:00"}]` (ใช้เมื่อ mode=fixed_schedule)
- อัปโหลดโลโก้ (สูงสุด 5MB, image/*)
- แก้ไขโปรไฟล์ธุรกิจ (รวมการตั้งค่าโพสต์อัตโนมัติ)
- ผู้ใช้หนึ่งคนสามารถเป็นเจ้าของธุรกิจได้หลายแห่ง
- ลบธุรกิจแบบ soft delete

### 3. บริการ / สินค้า
- เพิ่มบริการ/สินค้า (ชื่อ, คำอธิบาย, ราคา, รูปภาพ-ไม่บังคับ)
- แสดงรายการ / แก้ไข / ลบแบบ soft delete
- เปิดใช้งาน / ปิดใช้งาน
- **บริการเป็นแหล่งรวมทรัพยากรการตลาด** — AI จะดึงข้อมูลจากบริการเหล่านี้เมื่อสร้างเนื้อหาโพสต์
- สกุลเงิน: **THB เท่านั้น** (เก็บเป็นสตางค์ใน DB)

### 4. การเชื่อมต่อ Facebook
- เชื่อมต่อด้วย OAuth (Facebook Login for Business)
- แสดงรายการเพจที่ผู้ใช้ดูแล → เลือกเพจที่ต้องการโพสต์อัตโนมัติ (1 เพจต่อธุรกิจ)
- จัดเก็บ long-lived Page access token (เข้ารหัส AES-GCM)
- ยกเลิกการเชื่อมต่อ / เชื่อมต่อเพจใหม่
- Cron ต่ออายุ token ก่อนหมดอายุ (T-7 วัน)

### 5. Daily AI Decision (Flow หลัก)
- **ทุกวันเวลา 06:00 น.** Backend ส่งงาน "ตัดสินใจ" ไป AI Decision Service
- AI วิเคราะห์จาก:
  - จำนวนโพสต์สัปดาห์นี้ vs เป้าหมาย
  - ระยะห่างจากโพสต์ล่าสุด vs minGapDays
  - target_audience (เวลาที่ active)
- AI ตอบกลับ: shouldPost (true/false) + suggestedScheduledAt + postType + featuredServiceIds + captionHint
- ถ้า `shouldPost: false` → ข้ามวันนี้
- ถ้า `shouldPost: true` → สร้าง post + enqueue caption + media jobs

### 6. การสร้างเนื้อหาด้วย AI
- Backend เรียก **AI Caption Service** (FastAPI + Groq) เพื่อสร้างข้อความ (ภาษาไทย)
- Backend เรียก **n8n workflow** (HTTP webhook) เพื่อสร้างสื่อ:
  - **image** → Google Gemini 2.5 Flash (ขยาย prompt) → Nano Banana `gemini-3.1-flash-image` (สร้างภาพ)
  - **short_video** → Google Gemini 2.5 Flash (ขยาย prompt) → Veo 3.1 long-running operation (สร้างวิดีโอ)
  - **ผู้ใช้เลือก** image หรือ short_video ตอนสร้างโพสต์ (default = image) — ไม่ generate ทั้งสองอย่างพร้อมกัน
  - **Backend ออก MinIO presigned URL** ให้ n8n ใช้อัปโหลดไฟล์เข้า MinIO โดยตรง (n8n ไม่ต้องมี MinIO credentials)
  - **สถานะสื่อถูกควบคุมด้วย `ENABLE_AI_MEDIA`** env (default = `false` → ไม่ generate media, เปิด `true` เพื่อ generate ตาม mediaType ที่ผู้ใช้เลือก)
- นโยบายการลองใหม่: **3 ครั้ง, exponential backoff (1m, 5m, 15m)**, จากนั้น mark `failed` + email แจ้ง user
- หลัง media เสร็จ Backend เก็บ `PostMedia.kind` และ file URL ใน `post_media` + `files`
- เมื่อทั้ง 3 AI jobs (caption + media + decision) สำเร็จ → post → `pending_approval`
- **รองรับ image หรือ short_video** ต่อโพสต์ (1 สื่อต่อโพสต์ ไม่มี carousel ใน MVP)
- **Recap**: n8n callback payload มี `errorCode` + `metadata` (เช่น RAI filter reasons) เพื่อให้ backend เก็บเป็น structured data ใน `ai_jobs`

### 7. การสร้างโพสต์ด้วยตนเอง
- ปุ่ม "สร้างโพสต์" ใช้ได้เสมอ (แม้ auto-post ปิด)
- ส่งข้อมูลผ่านฟอร์ม:
  - `postType`: `promotion` | `product_showcase` | `brand_awareness` | `event`
  - **`mediaType`: `image` | `short_video`** (default = `image`) — เลือกได้ใน UI ตอนสร้างโพสต์
  - `featuredServiceIds[]` (optional)
  - `captionHint` (optional)
  - `scheduleAt` (optional — ถ้าไม่ระบุ AI จะเลือกเวลาให้)
- เรียกใช้ไปป์ไลน์ AI เดียวกับโหมดอัตโนมัติ

### 8. วงจรชีวิตของโพสต์และการอนุมัติ

**State Machine:**
```
draft → generating → pending_approval → approved → posted
                            ↓
                  rejected / expired / failed
```

**การอนุมัติ (3 ทางเลือก):**
- ✅ **อนุมัติ** (Approve) — post ตามเวลาที่ AI เลือก หรือแก้ caption/time ก่อน approve
- ❌ **ปฏิเสธ** (Reject) — ไม่โพสต์วันนี้ (พร้อมเหตุผล optional)
- ⏰ **ไม่ทำอะไร** — เมื่อเลย `scheduled_at` → **auto-reject** (status = `expired`)

**สำคัญ:** ใน MVP แก้ไขก่อนอนุมัติได้เฉพาะ **caption** และ **scheduled time** (ไม่มี image/video regen)

### 9. การจัดตาราง (Scheduling)
- **AI ตัดสินใจอัตโนมัติ** — เมื่อ `auto_post_mode = 'ai_decide'` (AI เลือกวัน+เวลาเอง)
- **ตารางคงที่** — เมื่อ `auto_post_mode = 'fixed_schedule'` ใช้ `fixed_schedule_rules` (cron hourly materialize 7 วันข้างหน้า)
- **ผู้ใช้เลือกเอง** — สำหรับ manual post (เลือกเวลาเอง หรือให้ AI เลือกให้)
- **Cron dispatcher** (ทุก 1 นาที) โพสต์ที่ approved + ถึงเวลาผ่าน Facebook Graph API

### 10. การแจ้งเตือน (Email เท่านั้นใน MVP)
- อีเมล "โพสต์พร้อมตรวจสอบ" (post ready)
- อีเมล "โพสต์ถูกเผยแพร่แล้ว" (posted)
- อีเมล "โพสต์ล้มเหลว" (failed หลัง retry หมด)
- อีเมล "โพสต์ถูกข้ามเนื่องจากไม่อนุมัติทันเวลา" (expired)
- ตาราง `email_logs` (สำหรับ debug และลองส่งใหม่)

### 11. แดชบอร์ด / Read APIs
- แสดงรายการธุรกิจที่ผู้ใช้เป็นเจ้าของ
- แสดงรายการโพสต์ต่อธุรกิจ (กรองตาม status, postType, ช่วงวันที่)
- ดูรายละเอียดโพสต์ (พร้อม media URLs, AI reasoning)
- แสดงโพสต์ที่รออนุมัติ / กำลังจะถึงกำหนด / ผ่านมา
- Pagination + filter

### 12. พื้นที่จับเก็บไฟล์ (File Storage)
- MinIO (S3-compatible) — local dev, S3-compatible สำหรับ prod
- **Presigned URL pattern** — Backend ออก URL ให้ AI services ใช้อัปโหลด (ไม่ต้องแชร์ credentials)
- Buckets: `logos/`, `services/`, `posts/media/`
- Public URL สำหรับ Facebook ดึงข้อมูลสื่อ
- Cleanup cron สำหรับไฟล์ที่ไม่มีการอ้างอิง

### 13. การสังเกตการณ์ (Observability) — เบื้องต้น
- Structured logging (pino) — JSON format
- Request ID middleware
- Endpoint `/health` (ตรวจ DB, Redis, S3)
- Bull Board สำหรับงานที่ล้มเหลว (เฉพาะ dev)

---

## 🔄 ขั้นตอนการใช้งานหลัก (Core User Flow)

```
1. ลงทะเบียน → ยืนยันอีเมล
2. เข้าสู่ระบบ
3. สร้างธุรกิจ
   ├─ ข้อมูลพื้นฐาน (ชื่อ, อุตสาหกรรม, โทน, กลุ่มเป้าหมาย, คำสำคัญ)
   ├─ การตั้งค่าโพสต์อัตโนมัติ
   │   ├─ enabled: true | false
   │   ├─ ถ้า true → mode: "ai_decide" | "fixed_schedule"
   │   ├─ postsPerWeekTarget: 3 (custom cadence)
   │   ├─ minGapDays: 1
   │   └─ ถ้า "fixed_schedule" → rules: [{day, time}, ...]
   └─ อัปโหลดโลโก้
4. เพิ่มบริการ/สินค้า (ตั้งแต่ 1 รายการขึ้นไป)
   └─ ชื่อ, คำอธิบาย, ราคา (THB), รูปภาพ (ทางเลือก)
5. เชื่อมต่อ Facebook Page (OAuth)
6. ── สาขา A: auto_post_enabled = TRUE, mode = ai_decide ──
   └─ 06:00 น. ทุกวัน → AI Decision Service → "วันนี้ควรโพสต์ไหม"
       └─ ถ้าใช่ → AI Caption + AI Media → email "post ready"
           └─ user approve / reject / ไม่ทำอะไร (auto-reject)
               └─ โพสต์ลง Facebook
7. ── สาขา B: auto_post_enabled = TRUE, mode = fixed_schedule ──
   └─ Cron hourly → materialize 7 วันข้างหน้า → AI ตัดสินใจ type/caption
       └─ email "post ready" → user approve → โพสต์
8. ── สาขา C: auto_post_enabled = FALSE ──
   └─ user คลิก "+ สร้างโพสต์" → AI Caption + Media → approve → โพสต์
9. ── ปุ่ม "สร้างโพสต์" (ใช้ได้เสมอ) ──
   └─ สำหรับโปรโมชัน, เนื้อหาเฉพาะกิจ, อีเวนต์พิเศษ
       ทางเลือก: เลือกบริการที่ต้องการนำเสนอ, เลือกประเภทโพสต์
```

ดูรายละเอียดทุก flow: [`userflow.md`](./userflow.md)

---

## 🗃️ แบบจำลองข้อมูล (Data Model)

PostgreSQL entities (TypeORM) — ดู schema ฉบับเต็ม: [`docs/02-DATA-MODEL.md`](./docs/02-DATA-MODEL.md)

- `users` — id, email, password_hash, email_verified_at
- `refresh_tokens` — id, user_id, token_hash, expires_at, revoked_at, replaced_by_id
- `email_verifications` — id, user_id, token_hash, expires_at, used_at
- `password_resets` — id, user_id, token_hash, expires_at, used_at
- `businesses` — id, owner_id, name, industry, description, tone, target_audience, keywords, **auto_post_enabled**, **auto_post_mode**, **posts_per_week_target**, **min_gap_days**, **fixed_schedule_rules (jsonb)**, logo_file_id
- `services` — id, business_id, name, description, **price_minor (bigint)**, currency ('THB'), image_file_id, is_active
- `files` — id, owner_id, kind ('logo'|'service_image'|'post_media'), storage_key, mime, size_bytes, public_url
- `facebook_pages` — id, business_id, fb_page_id, page_name, picture_url, access_token_encrypted (AES-GCM), token_expires_at, scopes
- `content_plans` — id, business_id, decided_by, status, should_post_today, ai_reasoning, suggested_post_type, suggested_featured_service_ids, suggested_caption_hint, suggested_scheduled_at, materialized_post_id
- `posts` — id, business_id, fb_page_id, caption, **status** (`draft` | `generating` | `pending_approval` | `approved` | `posted` | `rejected` | `expired` | `failed`), post_type, generation_source, scheduled_at, **approval_deadline**, posted_at, fb_post_id, **rejection_reason** (`user_rejected` | `timeout`), error_code, error_message
- `post_media` — id, post_id, file_id, kind (`image` | `short_video`), order_index
- `post_featured_services` — post_id, service_id (M2M)
- `ai_jobs` — id, post_id, plan_id, type (`caption` | `image` | `short_video`), status, attempts, max_attempts, last_error, payload, result, next_run_at
- `notifications` — id, user_id, post_id, type, channel, read_at
- `email_logs` — id, user_id, template, payload, status, provider_message_id, error, sent_at
- `unsubscribes` — id, user_id, token, category

---

## ⏰ Cron Jobs

| งาน | ตารางเวลา | วัตถุประสงค์ |
|---|---|---|
| `daily-decide` | **06:00 น. ทุกวัน** | สำหรับธุรกิจที่ mode='ai_decide' ส่งงาน "ตัดสินใจ" ไป AI Decision Service |
| `materialize-fixed-schedule` | ทุก 1 ชั่วโมง | แปลง `fixed_schedule_rules` เป็น content_plans ล่วงหน้า 7 วัน |
| `dispatch-due-posts` | ทุก 1 นาที | โพสต์ที่ approved + ถึงเวลาไป Facebook Graph API |
| `expire-pending-approvals` | **ใหม่** ทุก 1 นาที | mark เป็น `expired` เมื่อ approval_deadline < now |
| `ai-job-retry` | ทุก 30 วินาที | retry jobs ที่ล้มเหลว (exp backoff 1m, 5m, 15m) |
| `fb-token-refresh` | ทุกวัน | ต่ออายุ Facebook tokens ที่เหลือ < 7 วัน |
| `cleanup-orphan-files` | ทุกวัน | ลบไฟล์ที่ไม่มีการอ้างอิง |
| `drain-email-queue` | ทุก 1 นาที | ส่งอีเมลที่รออยู่ในคิว |

ดูรายละเอียด: [`docs/01-OVERVIEW.md`](./docs/01-OVERVIEW.md) section 7

---

## 🔌 API Contract

ดู contract ฉบับเต็ม (ทุก endpoint, schema, error codes): **[API.md](./API.md)**

ดู contract สำหรับแต่ละทีม:
- Frontend: [`docs/contracts/FRONTEND.md`](./docs/contracts/FRONTEND.md)
- AI Marketing: [`docs/contracts/AI-DECISION.md`](./docs/contracts/AI-DECISION.md), [`docs/contracts/AI-CAPTION.md`](./docs/contracts/AI-CAPTION.md)
- AI Media: [`docs/contracts/AI-MEDIA.md`](./docs/contracts/AI-MEDIA.md)

---

## 🗺️ Roadmap

| Phase | ขอบเขต | สถานะ |
|---|---|---|
| **P0** | Authentication, Business, Logo, File storage | ✅ เสร็จ |
| **P1** | Facebook OAuth, เชื่อมต่อเพจ, โพสต์ด้วยตนเอง (ไม่มี AI) | ✅ เสร็จ |
| **P2** | AI Caption + AI Media, ขั้นตอนอนุมัติ, อีเมล | ✅ เสร็จ (media ต้องตั้ง `ENABLE_AI_MEDIA=true` ใน backend `.env`) |
| **P3** | Daily AI decide, fixed schedule, cron dispatcher, auto-reject | ✅ เสร็จ |
| **P4** | ตกแต่ง, error handling, observability, retry policy, metrics | ✅ เสร็จ (มี health endpoint, request ID, Bull Board) |

---

## 🌐 Non-Goals (สิ่งที่ไม่ทำใน MVP)

- ❌ Multi-user collaboration ในธุรกิจเดียว
- ❌ Carousel (หลายภาพ/วิดีโอต่อโพสต์)
- ❌ Image/Video regeneration ในแอป (ต้องสร้างโพสต์ใหม่)
- ❌ Multiple Facebook pages ต่อธุรกิจ (เลือกได้แค่ 1)
- ❌ Instagram / TikTok integration
- ❌ Push notification (เฉพาะ email)
- ❌ WebSocket real-time (ใช้ polling 3 วินาที)
- ❌ Multi-language (เฉพาะไทย)
- ❌ Currency อื่นที่ไม่ใช่ THB

---

## ⚙️ Environment Variables ที่ควรรู้

### Backend (`backend/server/.env`)

| Key | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|
| `ENABLE_AI_MEDIA` | `false` | ตั้งเป็น `true` เพื่อ generate image / short_video ผ่าน n8n + Vertex AI (ต้องมี GCP service account) |
| `S3_PRESIGN_ENDPOINT` | `http://minio:9000` | Endpoint ที่ใช้ใน presigned URL สำหรับ MinIO (n8n ใช้ upload ผ่าน URL นี้) |
| `GCP_PROJECT_ID` | — | Google Cloud project ที่ใช้ Vertex AI (ต้องตั้งถ้าเปิด `ENABLE_AI_MEDIA`) |
| `GCP_VEO_OUTPUT_BUCKET` | — | GCS bucket ที่ Veo 3.1 เขียนวิดีโอลง (ต้องเป็น public read หรือ sign URL) |
| `APP_URL` | `http://localhost:3000` | URL ที่ n8n ใช้เรียก callback กลับมาที่ backend (ถ้ารันบน WSL ให้ตั้งเป็น IP ของ WSL) |

### Security

- **`gcp-key.json` ไม่ถูก commit ลง repo** — มี `.gitignore` และ template อยู่ที่ `gcp-key.json.example` (อย่าลืม rotate key ถ้าเคย leak)
- ดู [docs/00-INDEX.md](./docs/00-INDEX.md) สำหรับ contract ของแต่ละทีม
