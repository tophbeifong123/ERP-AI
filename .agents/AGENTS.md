# AGENTS.md — ERP-AI Project Rules & Design Guidelines

> AI-powered Facebook marketing platform for Thai SMEs
> **Status:** MVP / WIP — Backend P2 complete, Frontend scaffolded, AI services external

---

## 📌 General Rules

### Language & Communication
- เอกสารทั้งหมดและ comment ใน codebase ให้เขียนเป็น **ภาษาไทย** (ยกเว้น code identifiers, commit messages, และ technical terms)
- Commit messages ให้เขียนเป็น **ภาษาอังกฤษ** ตาม Conventional Commits format: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- ตอบคำถามผู้ใช้เป็น **ภาษาไทย** เสมอ ยกเว้นผู้ใช้ถามเป็นภาษาอังกฤษ

### Project Awareness
- โปรเจกต์นี้เป็น **Monorepo** ประกอบด้วย `frontend/`, `backend/server/`, `docs/`
- ก่อนแก้ไขโค้ดใดๆ ให้อ่านเอกสารที่เกี่ยวข้องใน `docs/` ก่อนเสมอ
- อ้างอิง `docs/PROGRESS.md` เมื่อต้องการทราบสถานะการพัฒนา
- อ้างอิง `docs/API.md` สำหรับ API contracts ที่ตกลงไว้แล้ว — **ห้ามเปลี่ยน API contract โดยไม่ได้รับอนุมัติจากผู้ใช้**

### Code Quality
- **ห้าม** ใช้ `any` type โดยไม่จำเป็น — ยกเว้น third-party library ที่บังคับ
- **ห้าม** comment out code แล้วทิ้งไว้ — ลบออกหรือใช้ feature flag แทน
- **ห้าม** hardcode secrets, API keys, หรือ credentials ลงใน source code
- **ห้าม** แก้ไขไฟล์ `.env.example` โดยไม่แจ้งผู้ใช้
- **ต้อง** preserve comments และ docstrings ที่มีอยู่เดิม ยกเว้นส่วนที่เกี่ยวข้องกับการแก้ไข

### Safety & Dependencies
- **ห้าม** เพิ่ม dependency ใหม่โดยไม่แจ้งผู้ใช้ก่อน — ระบุเหตุผลว่าทำไมถึงจำเป็น
- **ห้าม** ลบหรือเปลี่ยน dependency version ที่มีอยู่โดยไม่ได้รับอนุมัติ
- **ห้าม** แก้ไข migration files ที่ run ไปแล้ว — สร้าง migration ใหม่แทน
- ใช้ **pnpm** เป็น package manager (ทั้ง frontend และ backend)

---

## 🏗️ Backend Rules (`backend/server/`)

### Tech Stack
| Layer | Technology | Version |
|---|---|---|
| Framework | NestJS | 11 |
| Language | TypeScript | 5 (strictNullChecks: true) |
| ORM | TypeORM | 1.x |
| Database | PostgreSQL | 15 (with `citext` extension) |
| Queue | BullMQ + Redis 7 | via `@nestjs/bullmq` |
| File Storage | MinIO (S3-compatible) | via `@aws-sdk/client-s3` |
| Auth | JWT + Passport + argon2 | access 15m + refresh 7d |
| Email | Nodemailer | Mailhog in dev |
| Logging | pino + pino-http | Structured JSON |
| Validation | class-validator + class-transformer | |
| Testing | Jest 30 + supertest | |

### Architecture & Module Pattern
- ทุก feature module ต้องอยู่ใน `src/modules/<module-name>/` ประกอบด้วย:
  ```
  <module-name>/
  ├── <module-name>.module.ts
  ├── <module-name>.controller.ts
  ├── <module-name>.service.ts
  └── dto/
      ├── create-<name>.dto.ts
      └── update-<name>.dto.ts
  ```
- Cross-cutting concerns อยู่ใน `src/common/` (guards, decorators, filters, interceptors)
- Config อยู่ใน `src/config/` — ใช้ `@nestjs/config` + `registerAs()` pattern
- Entities อยู่ใน `src/database/entities/` — re-export ผ่าน `index.ts`
- Migrations อยู่ใน `src/database/migrations/`

### Naming Conventions
| Element | Convention | Example |
|---|---|---|
| Classes / Entities | PascalCase | `BusinessService`, `Post` |
| Properties / Methods | camelCase | `findOneById()`, `isActive` |
| DB Columns | snake_case (via `{ name: '' }`) | `created_at`, `auto_post_mode` |
| Files | kebab-case | `auth.controller.ts`, `create-business.dto.ts` |
| Modules | kebab-case directory | `modules/ai-jobs/` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Enums | PascalCase + UPPER_SNAKE_CASE values | `PostStatus.PENDING_APPROVAL` |

### API Design Rules
- RESTful controllers: `@Controller`, `@Get`, `@Post`, `@Patch`, `@Delete`
- Response format: `{ resource: data }` (เช่น `{ business }`, `{ user }`)
- UUID params: `@Param('id', new ParseUUIDPipe())`
- Auth: Global JWT guard (Passport), `@Public()` สำหรับ routes ที่ไม่ต้องการ auth
- Resource ownership: `@UseGuards(OwnerGuard)` + `@ResourceType('business')`
- Email verification: `@UseGuards(EmailVerifiedGuard)` สำหรับ protected routes
- Internal API: `InternalTokenGuard` ตรวจ `X-Internal-Token` header
- HTTP status: ใช้ `@HttpCode()` — 201 create, 204 delete, 202 accepted
- File uploads: `@UseInterceptors(FileInterceptor(...))` + size limits
- Validation: DTOs with class-validator + `whitelist: true` + `forbidNonWhitelisted: true` + `transform: true`

### Database Rules
- **ห้าม** ใช้ `synchronize: true` ใน production — ใช้ migrations เท่านั้น
- ราคาเก็บเป็น **สตางค์** (integer) — สกุลเงิน THB เท่านั้น
- ใช้ **UUID** เป็น primary key ทุก entity
- ใช้ **soft delete** (`deleted_at` column) สำหรับ Users, Businesses, Services
- ใช้ `citext` extension สำหรับ email columns (case-insensitive)
- Timestamps ใช้ `timestamptz` (timezone-aware) เสมอ

### Post State Machine
```
draft → generating → pending_approval → approved → posted
                           ↓
                 rejected / expired / failed
```
- **ห้าม** ข้าม state — transition ต้องเป็นไปตามลำดับที่กำหนดใน `state-machine.ts`
- ดู `docs/03-POST-LIFECYCLE.md` สำหรับรายละเอียดเพิ่มเติม

### Code Style (Backend)
- Prettier: `{ singleQuote: true, trailingComma: "all" }`
- ESLint: typescript-eslint `recommendedTypeChecked` + prettier plugin
- Rules: `no-explicit-any: off`, `no-floating-promises: warn`, `no-unsafe-argument: warn`
- **ต้อง** run `pnpm lint` ก่อน commit

---

## 💻 Frontend Rules (`frontend/`)

### Tech Stack
| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16 |
| React | React | 19 |
| Language | TypeScript | 5 (strict: true) |
| Styling | Tailwind CSS | 4 |
| UI Components | shadcn/ui (base-nova) | 4 |
| Icons | lucide-react | |
| Theme | next-themes | |
| Toast | sonner | |
| Utilities | clsx + tailwind-merge (cn) | |
| Animations | tw-animate-css | |

### Architecture & Directory Structure
- ใช้ **Next.js App Router** — ทุก page อยู่ใน `src/app/`
- **Components:** `src/components/` — แบ่งออกเป็น:
  * `ui/` (shadcn base components)
  * `layouts/` (Sidebar, Navbar, Switcher)
  * `shared/` (คอมโพเนนต์แชร์ทั่วไป เช่น Countdown, Player)
  * `features/` (คอมโพเนนต์เฉพาะทางธุรกิจ เช่น table, form ของโพสต์/บริการ)
- **Core Layer:** `src/core/` — แบ่งออกเป็น:
  * `services/` (API Clients เช่น `apiClient` และ API service callers)
  * `types/` (TypeScript Interfaces/DTOs)
  * `validations/` (Zod Validation schemas)
- **Hooks & State Management:** `src/hooks/` — แบ่งออกเป็น `store/` (Zustand client state) และ `queries/` (React Query server state)
- **Utilities:** `src/lib/` — สำหรับฟังก์ชันเสริมทั่วไป เช่น `utils.ts` (cn helper), datetime formatters, currency converters
- **Path alias:** `@/*` → `./src/*`


### Component Guidelines
- ใช้ **shadcn/ui** เป็น base components (14 components ติดตั้งแล้ว)
- เพิ่ม shadcn components ใหม่ผ่าน `npx shadcn add <component>` เท่านั้น
- ห้ามแก้ไขไฟล์ใน `src/components/ui/` โดยตรง ยกเว้นเรื่อง theming
- Custom components ให้สร้างนอก `ui/` directory
- ใช้ `cn()` helper (`clsx` + `tailwind-merge`) สำหรับ conditional classes

### Styling Rules
- ใช้ **Tailwind CSS v4** เป็นหลัก — ไม่ใช้ inline styles หรือ CSS modules (ยกเว้นมีเหตุผลพิเศษ)
- Theme colors ผ่าน CSS variables (กำหนดใน `globals.css`)
- Base color: **neutral** — ใช้ harmonious color palette
- ทุก interactive element ต้องมี **hover state** และ **focus state**
- ต้อง **responsive** — mobile-first design
- Dark mode support ผ่าน `next-themes`

### Frontend Status
> ✅ **Phase 1 Complete (Foundation & Auth):** หน้าแรก (Routing Gatekeeper), หน้า Login, Register, Forgot Password, Reset Password เสร็จสมบูรณ์แล้ว พร้อม API Client ที่รองรับ Token Rotation (Auto-refresh) และ Zustand Store
> ดู `docs/contracts/FRONTEND.md` สำหรับ contract ที่ frontend ต้องปฏิบัติตาม


---

## 🧪 Testing Rules

### Backend Testing
- ใช้ **Jest 30** + **ts-jest** + **supertest** (e2e)
- Test files: `*.spec.ts` อยู่ข้างไฟล์ที่ test (co-located)
- E2E tests อยู่ใน `backend/server/test/`
- Test scripts:
  - `pnpm test` — run unit tests
  - `pnpm test:watch` — watch mode
  - `pnpm test:cov` — coverage report
  - `pnpm test:e2e` — e2e tests

### Testing Best Practices
- ทุก service method ควรมี unit test
- ทุก controller endpoint ควรมี e2e test
- Mock external services (AI, Facebook, MinIO) ใน tests
- ตั้งชื่อ test ให้อธิบายพฤติกรรม: `it('should return 401 when token is expired')`

---

## 🐳 Infrastructure & DevOps

### Docker Compose Services
| Service | Purpose | Ports |
|---|---|---|
| PostgreSQL 15 | Primary database | 5432 |
| Redis 7 | Queue broker + cache | 6379 |
| MinIO | S3-compatible file storage | 9000 (API), 9001 (Console) |
| Mailhog | Email testing (dev) | 1025 (SMTP), 8025 (UI) |

### Development Setup
```bash
# 1. Start infrastructure
docker compose up -d

# 2. Backend
cd backend/server
cp .env.example .env
pnpm install
pnpm migration:run
pnpm start:dev          # http://localhost:3000

# 3. Frontend
cd frontend
pnpm install
pnpm dev                # http://localhost:3001
```

### Environment Variables
- **ห้าม** commit `.env` file — ใช้ `.env.example` เป็น template
- ทุก env var ใหม่ต้องเพิ่มใน `.env.example` พร้อมค่า default ที่ปลอดภัย
- ใช้ `@nestjs/config` + `registerAs()` pattern สำหรับ config ใน backend

---

## 📁 Key Documentation References

| Document | Purpose |
|---|---|
| `docs/00-INDEX.md` | สารบัญเอกสาร + reading order ตามบทบาท |
| `docs/01-OVERVIEW.md` | สถาปัตยกรรมระบบ, ทีม, เทคโนโลยี |
| `docs/02-DATA-MODEL.md` | Schema ฐานข้อมูล, ER diagram |
| `docs/03-POST-LIFECYCLE.md` | Post state machine |
| `docs/04-DAILY-DECISION.md` | กฎ AI Decision Service |
| `docs/05-AUTO-REJECT.md` | Auto-reject flow |
| `docs/06-AUTH.md` | JWT, refresh tokens, email verify |
| `docs/07-OBSERVABILITY.md` | Logging, health checks |
| `docs/API.md` | API contract ฉบับเต็ม |
| `docs/userflow.md` | 11 user flows ทั้งหมด |
| `docs/PROGRESS.md` | สถานะการพัฒนา |
| `docs/contracts/` | Contracts สำหรับทีม AI + Frontend |

---

## 🔒 Security Rules

- **Secrets**: ใช้ environment variables เท่านั้น — ห้าม hardcode
- **Passwords**: Hash ด้วย **argon2id** — ห้ามใช้ bcrypt หรือ SHA
- **JWT**: Access token 15 นาที, Refresh token 7 วัน, token rotation
- **Facebook tokens**: เข้ารหัสด้วย **AES-256-GCM** (`EncryptionService`)
- **Internal API**: ใช้ `X-Internal-Token` header สำหรับ AI service callbacks
- **Input validation**: ใช้ class-validator DTOs + whitelist + forbidNonWhitelisted
- **File uploads**: จำกัดขนาดไฟล์ (5MB สำหรับ logos) + ตรวจ MIME type
- **CORS**: อนุญาตเฉพาะ frontend URL ที่กำหนดไว้

---

## ⚠️ Important Constraints

1. **MVP Scope** — อย่าเพิ่ม features นอกเหนือจากที่ระบุใน docs โดยไม่ได้รับอนุมัติ
2. **Thai SME Focus** — UI/UX ต้องเป็นมิตรกับผู้ใช้คนไทย, ข้อความแสดงผลเป็นภาษาไทย
3. **Single Media per Post** — MVP รองรับ 1 media (image หรือ short_video) ต่อ 1 post — ไม่มี carousel
4. **THB Only** — สกุลเงินเดียวคือ บาท (เก็บเป็นสตางค์)
5. **External AI Services** — AI services (decision, caption, media) เป็นบริการภายนอก — backend เป็นแค่ orchestrator
6. **Email-only Notifications** — MVP ใช้ email เท่านั้น (ยังไม่มี push notifications)
7. **1 Page per Business** — ธุรกิจแต่ละแห่งเชื่อมต่อได้ 1 Facebook Page เท่านั้น

---

## 🔄 Cron Jobs Reference

| Schedule | Purpose |
|---|---|
| `0 6 * * *` (Bangkok TZ) | Daily AI decision สำหรับ ai_decide businesses |
| Every hour | Materialize fixed_schedule rules 7 วันข้างหน้า |
| Every minute | Dispatch approved posts ไป Facebook |
| Every minute | Expire pending approvals ที่เลยเวลา |
| Every 30 seconds | Retry failed AI jobs |
| Daily 1AM | Refresh Facebook tokens ที่จะหมดอายุใน 7 วัน |
| Daily 2AM | Cleanup refresh tokens ที่หมดอายุ |
| Daily 3AM | Cleanup orphan files ใน MinIO |
