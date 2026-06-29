# 03. Post Lifecycle (วงจรชีวิตของโพสต์)

> เอกสารนี้อธิบาย state machine ของ `posts.status` และ transitions ที่อนุญาต
> อัปเดตล่าสุด: มิถุนายน 2026 (เพิ่ม `mediaType`, `failed → pending_approval` revive logic, `posts.errorCode`)

---

## 1. State Diagram

```
                          ┌──────────┐
                          │  draft   │ (internal — ใช้เฉพาะ manual create ก่อนส่ง AI)
                          └────┬─────┘
                               │ backend enqueue
                               ▼
                          ┌────────────┐
              ┌──────────▶│ generating │◀─────────────┐
              │           └──────┬─────┘              │
              │ regenerate*     │ caption + media    │
              │ (no MVP)        │ callback success   │
              │                 ▼                    │
              │          ┌────────────────┐          │
              │  ┌──────▶│pending_approval│◀─────────┘
              │  │       └─┬──────┬───────┘    (revive from failed:
              │  │         │      │ approve    retry succeeded)
              │  │         │      ▼
              │  │         │  ┌──────────┐    ┌────────┐
              │  │         │  │ approved │───▶│ posted │
              │  │         │  └────┬─────┘    └────────┘
              │  │         │       │             ▲
              │  │         │       │ dispatch    │ success
              │  │         │       │ (1 min cron)│
              │  │         │       ▼             │
              │  │         │   [dispatched]──────┘
              │  │         │
              │  │ reject  │ ไม่อนุมัติทันเวลา
              │  │         │ (1 min cron)
              │  │         ▼             ▼
              │  │   ┌──────────┐  ┌─────────┐
              │  └───│ rejected │  │ expired │
              │      └──────────┘  └─────────┘
              │
              │   ┌──────────┐        ┌──────────────────┐
              └──▶│  failed  │───────▶│ (retry succeeds) │
                  └──────────┘        └──────────────────┘
```

หมายเหตุ: เส้นทาย `--▶│ failed │───────▶ (retry succeeds) ───▶│ pending_approval │` คือ **revive logic**: ถ้า post ถูก mark เป็น `failed` (เช่น ครั้งแรก GCS โหลดไฟล์ไม่ได้) แต่ media job retry สำเร็จในภายหลัง Backend `checkPostGenerationComplete()` จะ clear `errorCode/errorMessage` แล้ว transition post กลับเป็น `pending_approval` โดยอัตโนมัติ

---

## 2. States

| Status | ความหมาย | ใครเป็นคน set |
|---|---|---|
| `draft` | internal — ใช้ตอนสร้าง post แต่ยังไม่ enqueue AI | Backend (manual create) |
| `generating` | AI กำลังสร้าง caption/media/decision | Backend (หลัง enqueue jobs) |
| `pending_approval` | รอ user อนุมัติ | Backend (หลัง media+caption callback) — **หรือ** หลัง revive |
| `approved` | user อนุมัติแล้ว รอเวลาโพสต์ | User (POST /posts/{id}/approve) |
| `posted` | โพสต์ไป Facebook สำเร็จ | Backend (dispatch cron) |
| `rejected` | user ปฏิเสธ | User (POST /posts/{id}/reject) |
| `expired` | ไม่อนุมัติทันเวลา | Backend (expire cron) |
| `failed` | AI job fail 3 ครั้ง / Facebook API fail 3 ครั้ง | Backend (retry exhausted) — **revive ได้** ถ้า retry ต่อไปสำเร็จ |

### 2.1 เพิ่มเติม: `posts.mediaType` (ถูกเพิ่ม มิ.ย. 2026)

- **enum** `image` | `short_video` (default `image`)
- ผู้ใช้เลือกตอนสร้างโพสต์ผ่าน modal (`CreatePostModal`)
- Backend เก็บลง column `posts.media_type` (text) พร้อม `NOT NULL DEFAULT 'image'`
- ควบคุม media job ที่ enqueue: enqueue `AiJob.type='image'` หรือ `'short_video'` ตามค่านี้ (เลือกอย่างใดอย่างหนึ่ง, ไม่ใช่ทั้งคู่)
- ใช้ใน frontend เพื่อแสดง in-flight placeholder ที่ถูกต้อง ("กำลังสร้างรูปภาพ…" vs "กำลังสร้างวิดีโอ…")

### 2.2 เพิ่มเติม: structured failure context (มิ.ย. 2026)

`posts.errorCode` (text) และ `ai_jobs.errorCode` (text) + `ai_jobs.metadata` (jsonb) เก็บ structured failure data:

- **errorCode**: machine-readable code เช่น `content_safety`, `upload_failed`, `E_NO_FB_PAGE`, `E_FB`
- **metadata**: เก็บ structured data เช่น `{"raiMediaFilteredReasons": ["Recitation check failed."]}`

ตัวอย่าง: ถ้า Veo 3.1 block content ด้วย recitation check, n8n จะ POST error callback พร้อม `error.code = "content_safety"` และ `metadata.raiMediaFilteredReasons = ["Recitation check failed."]` → backend เก็บทั้งคู่ลง `ai_jobs` (structured) และ `last_error` (human-readable) — แล้ว post → `failed` พร้อม `errorMessage = "AI short_video job failed: content_safety: Content was filtered by Vertex AI safety check: Recitation check failed."`

---

## 3. Allowed Transitions

| From | Event | To | ใคร trigger |
|---|---|---|---|
| `draft` | enqueue AI jobs | `generating` | Backend (manual create) |
| `generating` | caption + media callback success | `pending_approval` | Backend (callback) |
| `generating` | 1 ในของ AI fail 3 ครั้ง | `failed` | Backend (retry) |
| `failed` | retry สำเร็จในภายหลัง (clear error fields) | `pending_approval` | Backend (`checkPostGenerationComplete` — **revive**) |
| `pending_approval` | user approve | `approved` | User |
| `pending_approval` | user reject | `rejected` | User |
| `pending_approval` | scheduled_at < now (cron) | `expired` | Backend (expire cron) |
| `approved` | scheduled_at <= now + dispatch สำเร็จ | `posted` | Backend (dispatch cron) |
| `approved` | dispatch fail 3 ครั้ง | `failed` | Backend (retry) |

### Transitions ที่ **ไม่อนุญาต**

- ❌ `posted` → อะไรก็ตาม (terminal)
- ❌ `rejected` → อะไรก็ตาม (terminal ใน MVP — ไม่มี undo)
- ❌ `expired` → อะไรก็ตาม (terminal)
- ❌ `expired` → อะไรก็ตาม (terminal)
- ❌ `failed` → อะไรก็ตาม (terminal — user ต้องสร้าง post ใหม่)
- ❌ `approved` → `pending_approval` (ห้าม undo)
- ❌ `pending_approval` → `pending_approval` (idempotent approve ต้อง 409)

**ข้อยกเว้น:** ทุก transition ต้องผ่าน `state-machine.ts` ใน Backend — controller ไม่สามารถ UPDATE status ตรงๆ ได้

---

## 4. State Machine Implementation

### 4.1 ไฟล์: `src/modules/posts/state-machine.ts`

```typescript
export type PostStatus =
  | 'draft'
  | 'generating'
  | 'pending_approval'
  | 'approved'
  | 'posted'
  | 'rejected'
  | 'expired'
  | 'failed';

const allowedTransitions: Record<PostStatus, PostStatus[]> = {
  draft:             ['generating', 'failed'],
  generating:        ['pending_approval', 'failed'],
  pending_approval:  ['approved', 'rejected', 'expired', 'failed'],
  approved:          ['posted', 'failed'],
  posted:            [],
  rejected:          [],
  expired:           [],
  failed:            [],
};

export function canTransition(from: PostStatus, to: PostStatus): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

export class PostStateMachine {
  static transition(post: Post, to: PostStatus, ctx: TransitionContext) {
    if (!canTransition(post.status, to)) {
      throw new InvalidStateError(post.status, to);
    }
    post.status = to;
    // side effects per transition (e.g., set posted_at when → posted)
  }
}
```

### 4.2 การใช้งานใน Controller

```typescript
// ❌ ห้ามทำแบบนี้
@Post(':id/approve')
async approve(@Param('id') id: string) {
  await this.posts.update(id, { status: 'approved' });  // ผิด! bypass state machine
}

// ✅ ต้องทำแบบนี้
@Post(':id/approve')
async approve(@Param('id') id: string, @Body() dto: ApproveDto) {
  const post = await this.posts.findOneOrFail(id);
  PostStateMachine.transition(post, 'approved', { actor: 'user', ...dto });
  return this.posts.save(post);
}
```

---

## 5. Side Effects per Transition

### 5.1 `generating` → `pending_approval`

```typescript
// ใน callback handler
post.status = 'pending_approval';
post.approval_deadline = post.scheduled_at;  // = scheduled_at
// INSERT notification
// Enqueue email "post-ready"
```

### 5.2 `pending_approval` → `approved`

```typescript
// ใน approve handler
post.status = 'approved';
if (dto.caption) post.caption = dto.caption;
if (dto.scheduledAt) {
  post.scheduled_at = dto.scheduledAt;
  post.approval_deadline = dto.scheduledAt;
}
```

### 5.3 `pending_approval` → `expired`

```typescript
// ใน expire cron
post.status = 'expired';
post.rejection_reason = 'timeout';
// INSERT notification (type=post_expired)
// Enqueue email "post-expired"
```

### 5.4 `pending_approval` → `rejected`

```typescript
// ใน reject handler
post.status = 'rejected';
post.rejection_reason = 'user_rejected';
if (dto.reason) post.error_message = dto.reason;
```

### 5.5 `approved` → `posted`

```typescript
// ใน dispatch-due-posts cron
post.status = 'posted';
post.posted_at = new Date();
post.fb_post_id = result.id;
// INSERT notification (type=post_posted)
// Enqueue email "post-posted"
```

### 5.6 `*` → `failed`

```typescript
post.status = 'failed';
post.error_code = ctx.errorCode;
post.error_message = ctx.errorMessage;
// INSERT notification (type=post_failed)
// Enqueue email "post-failed"
```

---

## 6. UI Display per Status

| Status | Dashboard Card | Post Detail Page |
|---|---|---|
| `draft` | ไม่แสดง (internal) | ไม่แสดง |
| `generating` | ไม่แสดง (internal) | "AI กำลังสร้างโพสต์..." + spinner |
| `pending_approval` | "⏰ รออนุมัติ" + countdown | ปุ่ม "อนุมัติ/ปฏิเสธ" + แก้ caption/time |
| `approved` | "✅ อนุมัติแล้ว" + เวลาจะโพสต์ | "จะโพสต์เวลา XX:XX" (read-only) |
| `posted` | "✅ เผยแพร่แล้ว" + ลิงก์ FB | "โพสต์สำเร็จ" + ลิงก์ FB |
| `rejected` | ไม่แสดงบน dashboard | "❌ ปฏิเสธแล้ว" (ประวัติ) |
| `expired` | ไม่แสดงบน dashboard | "⏰ หมดเวลา" (ประวัติ) |
| `failed` | ไม่แสดงบน dashboard | "⚠️ ล้มเหลว" + error (ประวัติ) |

ดูเพิ่ม: [`contracts/FRONTEND.md`](./contracts/FRONTEND.md) section 5.1

---

## 7. Terminal States Behavior

Posts ใน `posted`, `rejected`, `expired`, `failed` เป็น terminal — ไม่สามารถเปลี่ยนแปลงได้อีก

**สิ่งที่ user ทำได้กับ terminal posts:**
- ดู read-only
- (อาจ) คลิก "สร้างโพสต์ใหม่" เพื่อ generate post ใหม่ (Phase 4)

**สิ่งที่ user ทำไม่ได้:**
- แก้ caption
- Re-approve
- Re-dispatch

---

## 8. Edge Cases

### 8.1 User approve หลัง scheduled_at แต่ก่อน cron ทำงาน

- status: `pending_approval` → `approved`
- scheduled_at: < now
- Cron dispatch รอบถัดไป (≤ 1 นาที) → dispatch ทันที
- ✅ ทำงานถูกต้อง

### 8.2 User approve ขณะ expire cron กำลังทำงาน

- Race condition: ทั้ง approve และ expire พร้อมกัน
- **Backend ใช้ `SELECT ... FOR UPDATE` ใน transaction** เพื่อ serialize
- ถ้า expire ชนะก่อน → approve ได้ 409 `invalid_state`
- ถ้า approve ชนะก่อน → expire ไม่ทำอะไร (status เปลี่ยนแล้ว)

### 8.3 Dispatch fail หลัง approve

- status: `approved` → `failed`
- Email แจ้ง user
- User ต้องสร้าง post ใหม่ (ไม่มี retry ใน MVP)

### 8.4 AI fail ทั้ง caption และ media

- ถ้า 1 ใน 2 fail → retry เฉพาะตัวที่ fail
- ถ้าทั้งคู่ fail 3 ครั้ง → post = `failed`

---

## 9. อ่านเพิ่มเติม

- [`02-DATA-MODEL.md`](./02-DATA-MODEL.md) — `posts` schema
- [`04-DAILY-DECISION.md`](./04-DAILY-DECISION.md) — เริ่มต้นจากไหน
- [`05-AUTO-REJECT.md`](./05-AUTO-REJECT.md) — flow auto-reject
- [`contracts/FRONTEND.md`](./contracts/FRONTEND.md) — UI แสดงผลแต่ละ status

อัปเดตล่าสุด: 2026-06-27
