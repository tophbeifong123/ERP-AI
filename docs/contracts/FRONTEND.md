# Contract: Frontend (Next.js)

> สำหรับทีม **frontend dev**
> เอกสารนี้อธิบาย Backend API ที่ frontend ต้องเรียก และพฤติกรรม UI ที่คาดหวัง
> ดูรายละเอียด endpoint ทั้งหมดได้ที่ [`API.md`](../../API.md)

---

## ภาพรวม

- **Base URL (dev):** `http://localhost:3000`
- **Base URL (prod):** `https://api.example.com`
- **Authentication:** `Authorization: Bearer <accessToken>` ในทุก request ยกเว้น `/auth/*` และ `/health`
- **Time zone:** Backend เก็บเวลาเป็น **UTC** เสมอ ให้ frontend แปลงเป็น **Asia/Bangkok** ตอนแสดงผล
- **Pagination:** Query `?page=1&limit=20` (default `page=1`, `limit=20`, max `limit=100`)

---

## 1. โครงสร้าง Response ทั่วไป

### สำเร็จ

```json
{ "data": {...} }
```

หรือ

```json
{ "list": [...], "total": 100, "page": 1, "limit": 20 }
```

### Error (ทุก endpoint ใช้รูปแบบเดียวกัน)

```json
{
  "statusCode": 422,
  "error": "validation_failed",
  "message": "Validation failed",
  "details": [
    { "field": "email", "message": "must be a valid email" }
  ]
}
```

### Error Codes ที่ frontend ต้องจัดการ

| HTTP | `error` code | ความหมาย | UX |
|---|---|---|---|
| 400 | `bad_request` | request body ผิดพลาด | toast "คำขอไม่ถูกต้อง" |
| 401 | `unauthorized` | token หมดอายุ/ไม่ถูกต้อง | redirect → login |
| 403 | `forbidden` | email ยังไม่ verify / ไม่ใช่ owner | toast + redirect (กรณี verify) |
| 404 | `not_found` | resource ไม่เจอ | toast "ไม่พบข้อมูล" |
| 409 | `conflict` | email ซ้ำ / state ไม่ถูกต้อง | toast "ทำรายการไม่ได้" |
| 422 | `validation_failed` | validation fail | แสดง field error ใต้ input |
| 429 | `rate_limited` | เกิน rate limit | toast + ปุ่ม retry หลัง 1 นาที |
| 500 | `internal_error` | server error | toast "เกิดข้อผิดพลาด กรุณาลองใหม่" |

---

## 2. Auth Flow

### 2.1 เก็บ Token

- **access token:** เก็บใน **memory** (state ของ React/Next.js)
- **refresh token:** เก็บใน **httpOnly cookie** (ปลอดภัยกว่า localStorage)

### 2.2 Token Refresh

- เมื่อได้ response 401 → เรียก `POST /auth/refresh { refreshToken }` → ได้ accessToken ใหม่ → retry request เดิม
- ถ้า refresh fail → redirect ไป login

### 2.3 Endpoints

| Endpoint | ใช้ตอน |
|---|---|
| `POST /auth/register` | หน้าสมัคร |
| `POST /auth/login` | หน้า login |
| `POST /auth/refresh` | auto refresh |
| `POST /auth/logout` | ปุ่ม logout |
| `POST /auth/forgot-password` | หน้าลืมรหัส |
| `POST /auth/reset-password` | หน้ารีเซ็ต (จาก link ในอีเมล) |
| `POST /auth/verify-email` | หน้า verify (จาก link ในอีเมล) |

---

## 3. Business Management

### 3.1 List ธุรกิจทั้งหมดของ user

```http
GET /businesses
```

```json
{
  "businesses": [
    {
      "id": "uuid",
      "name": "ร้านก๋วยเตี๋ยวลุงมา",
      "industry": "อาหารและเครื่องดื่ม",
      "logo": { "publicUrl": "https://..." } | null,
      "autoPost": {
        "enabled": true,
        "mode": "ai_decide",
        "postsPerWeekTarget": 3,
        "minGapDays": 1,
        "fixedScheduleRules": []
      },
      "createdAt": "2026-06-27T06:00:00.000Z"
    }
  ]
}
```

### 3.2 สร้างธุรกิจ (multipart)

```http
POST /businesses
Content-Type: multipart/form-data

name=...
industry=...
description=...
targetAudience=...
tone=...
keywords[]=ก๋วยเตี๋ยว
keywords[]=ต้มยำ
logo=<file>
autoPost.enabled=true
autoPost.mode=ai_decide
autoPost.postsPerWeekTarget=3
autoPost.minGapDays=1
```

### 3.3 ตั้งค่า auto-post

```http
PATCH /businesses/{id}/auto-post
Content-Type: application/json

{
  "enabled": true,
  "mode": "ai_decide",       // หรือ "fixed_schedule"
  "postsPerWeekTarget": 3,
  "minGapDays": 1,
  "fixedScheduleRules": [     // required เมื่อ mode = fixed_schedule
    {"dayOfWeek": 1, "time": "20:00"},
    {"dayOfWeek": 4, "time": "10:00"}
  ]
}
```

`dayOfWeek`: 0=อาทิตย์, 1=จันทร์, ..., 6=เสาร์
`time`: รูปแบบ HH:mm (24-hour) ใน Asia/Bangkok

### 3.4 UI Behavior

- ถ้า `enabled = false` → ซ่อนส่วน auto-post ทั้งหมด, แสดงแค่ปุ่ม "สร้างโพสต์ด้วยตนเอง"
- ถ้า `mode = ai_decide` → แสดง cadence (posts/week, min gap), ไม่มี UI สำหรับเวลา
- ถ้า `mode = fixed_schedule` → แสดงตาราง (day + time) ที่ user แก้ไขได้

---

## 4. Service Management

### 4.1 List services

```http
GET /businesses/{id}/services?active=true&page=1&limit=20
```

### 4.2 เพิ่ม/แก้ service (multipart)

```http
POST /businesses/{id}/services
Content-Type: multipart/form-data

name=...
description=...
price=60           // หน่วยบาท (frontend เก็บเป็นบาท, backend เก็บเป็นสตางค์)
image=<file>       // optional
```

**สำคัญ:** Frontend รับ/ส่ง `price` เป็น **บาท (ทศนิยมได้)** แต่ backend เก็บเป็น **สตางค์ (bigint)** — ดู section 6 สำหรับการแปลง

---

## 5. Post Management (ส่วนสำคัญที่สุด)

### 5.1 Post Status (State Machine)

```
draft → generating → pending_approval → approved → posted
                            ↓
                        rejected / expired / failed
```

| Status | ความหมาย | UI แสดง |
|---|---|---|
| `draft` | ยังไม่สมบูรณ์ | ไม่ควรเจอ (internal) |
| `generating` | AI กำลังสร้าง caption/รูป | "AI กำลังสร้างโพสต์..." + spinner |
| `pending_approval` | รอ user อนุมัติ | ปุ่ม "ดู/อนุมัติ/ปฏิเสธ" |
| `approved` | user อนุมัติแล้ว รอเวลาโพสต์ | "จะโพสต์เวลา XX:XX" |
| `posted` | โพสต์แล้ว | "✅ เผยแพร่แล้ว" + ลิงก์ไป FB |
| `rejected` | user ปฏิเสธ | "❌ ปฏิเสธแล้ว" (อยู่ในประวัติ) |
| `expired` | ไม่อนุมัติทันเวลา (auto) | "⏰ หมดเวลา" (อยู่ในประวัติ) |
| `failed` | ส่งไป FB ล้มเหลว 3 ครั้ง | "⚠️ ล้มเหลว" + error |

### 5.2 Post Type

| Value | UI แสดง |
|---|---|
| `promotion` | โปรโมชัน |
| `product_showcase` | แสดงสินค้า |
| `brand_awareness` | สร้างการรับรู้แบรนด์ |
| `event` | อีเวนต์ |
| `null` (manual, user เลือก AI) | กำหนดเอง |

### 5.3 Post Object

```typescript
type Post = {
  id: string;
  businessId: string;
  fbPageId: string | null;
  caption: string | null;
  status: "draft" | "generating" | "pending_approval" | "approved"
        | "posted" | "rejected" | "expired" | "failed";
  postType: "promotion" | "product_showcase" | "brand_awareness" | "event" | null;
  generationSource: "auto_ai" | "fixed_schedule" | "manual";
  scheduledAt: string | null;        // ISO UTC
  postedAt: string | null;          // ISO UTC
  approvalDeadline: string | null;  // ISO UTC (= scheduledAt)
  rejectionReason: "user_rejected" | "timeout" | null;
  error: string | null;
  media: PostMedia[];               // 1 รายการ (image หรือ short_video)
  featuredServices: Service[];
  createdAt: string;
  updatedAt: string;
};

type PostMedia = {
  id: string;
  kind: "image" | "short_video";
  file: { publicUrl: string; mime: string; sizeBytes: number };
  orderIndex: number;
};
```

### 5.4 List Posts

```http
GET /businesses/{id}/posts?status=pending_approval&page=1&limit=20
GET /businesses/{id}/posts?status=posted&from=2026-06-01&to=2026-06-30
```

| Query | Type | คำอธิบาย |
|---|---|---|
| `status` | string | filter (comma-separated ได้ เช่น `posted,rejected`) |
| `postType` | string | filter |
| `from` | ISO date | filter `postedAt >= from` |
| `to` | ISO date | filter `postedAt <= to` |
| `page` | int | pagination |
| `limit` | int | max 100 |

### 5.5 Post Detail

```http
GET /posts/{id}
```

### 5.6 Approve (พร้อมแก้ caption/time)

```http
POST /posts/{id}/approve
Content-Type: application/json

{
  "caption": "แคปชั่นใหม่...",        // optional — ถ้าไม่ส่งใช้ของ AI
  "scheduledAt": "2026-06-27T20:00:00.000Z"  // optional — ถ้าไม่ส่งใช้ของ AI
}
```

**Response:** 200 OK
```json
{ "post": { "id": "uuid", "status": "approved" } }
```

**Errors:**
- `409 invalid_state` — post ไม่อยู่ใน `pending_approval`
- `422 validation_failed` — caption ว่าง / scheduledAt ในอดีต

### 5.7 Reject

```http
POST /posts/{id}/reject
Content-Type: application/json

{ "reason": "วันนี้ไม่เหมาะ" }  // optional
```

**Response:** 200 OK
```json
{ "post": { "id": "uuid", "status": "rejected" } }
```

### 5.8 สร้าง Manual Post

```http
POST /businesses/{id}/posts
Content-Type: application/json

{
  "postType": "promotion",
  "featuredServiceIds": ["uuid1", "uuid2"],
  "captionHint": "เน้นโปรโมชันวันศุกร์",
  "scheduleAt": "2026-06-28T11:00:00.000Z"   // optional — ถ้าไม่ส่ง AI จะเลือกเวลาให้
}
```

**Response:** 202 Accepted
```json
{
  "post": { "id": "uuid", "status": "generating" },
  "message": "post is being generated, you will be notified by email"
}
```

### 5.9 หมายเหตุ: ไม่มี image regen ใน MVP

- ❌ **ไม่มี** `POST /posts/{id}/regenerate-media`
- ❌ **ไม่มี** endpoint สำหรับ regenerate image/video
- ✅ แก้ได้เฉพาะ **caption** และ **scheduled time** ก่อน approve

---

## 6. การแปลงเวลา (Time Zone)

### หลักการ

- **Backend เก็บเป็น UTC เสมอ** (ISO 8601)
- **Frontend แสดงเป็น Asia/Bangkok (UTC+7)**

### ตัวอย่าง

```typescript
// Input จาก API: "2026-06-27T11:00:00.000Z" (UTC)
// แสดงใน UI: "27 มิ.ย. 2569 18:00 น." (Asia/Bangkok)

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

function formatBKK(isoUtc: string): string {
  const bkk = toZonedTime(isoUtc, 'Asia/Bangkok');
  return format(bkk, 'd MMM yyyy HH:mm น.', { locale: th });
}
```

### กรณีที่ user แก้เวลา

1. User เลือกวันที่/เวลาใน date picker (Asia/Bangkok)
2. Frontend แปลงเป็น UTC ก่อนส่ง
3. Backend เก็บเป็น UTC

```typescript
// ใช้ date-fns-tz หรือ luxon
import { fromZonedTime } from 'date-fns-tz';

const bkkDate = new Date('2026-06-27T18:00:00');  // Asia/Bangkok
const utcIso = fromZonedTime(bkkDate, 'Asia/Bangkok').toISOString();
// → "2026-06-27T11:00:00.000Z"
```

---

## 7. การแปลงราคา (Money)

### หลักการ

- **Frontend** แสดง/รับ input เป็น **บาท (ทศนิยม)** เช่น 60.00
- **Backend** เก็บเป็น **สตางค์ (bigint)** เช่น 6000

### ตัวอย่าง

```typescript
// บาท → สตางค์ (ตอนส่งให้ backend)
function bahtToSatang(baht: number): number {
  return Math.round(baht * 100);
}

// สตางค์ → บาท (ตอนรับจาก backend)
function satangToBaht(satang: number): number {
  return satang / 100;
}

// แสดงราคา
function formatPrice(satang: number): string {
  const baht = satangToBaht(satang);
  return `฿${baht.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
```

### Display

- ใช้ `Intl.NumberFormat('th-TH')` หรือ helper ข้างบน
- ตัวอย่าง: `formatPrice(6000)` → `"฿60"`
- ตัวอย่าง: `formatPrice(12500)` → `"฿125"`

---

## 8. UI Screens ที่ต้องมี

### 8.1 หน้า Login / Register / Forgot Password
- ตาม `userflow.md` section 1, 3, 4

### 8.2 Onboarding (4 steps)
- ตาม `userflow.md` section 6

### 8.3 Dashboard
- Header: business switcher, auto-post status, "ตั้งค่า" ปุ่ม
- Section "โพสต์ถัดไป (รออนุมัติ)" — list posts where `status = 'pending_approval'`
- Section "โพสต์ที่กำลังจะถึงกำหนด" — list posts where `status = 'approved'` and `scheduledAt > now`
- Section "โพสต์ที่ผ่านมา" — list `status = 'posted'` limit 5
- Stats: สัปดาห์นี้ X/Y โพสต์, ทั้งหมด N โพสต์
- ปุ่ม "+ สร้างโพสต์ด้วยตนเอง" (มุมล่างขวา)

### 8.4 Post Detail (หน้าอนุมัติ)
- แสดง media (image หรือ video player)
- Caption (editable)
- scheduledAt (editable via date/time picker)
- AI reasoning (read-only)
- ปุ่ม "อนุมัติ" / "ปฏิเสธ"
- ปุ่ม timer แสดงเวลาที่เหลือก่อน auto-reject

### 8.5 Create Manual Post
- ตาม `userflow.md` section 9

### 8.6 Post History
- Filter by status (checkbox)
- Filter by date range
- Pagination
- คลิกแต่ละรายการ → Post Detail (read-only)

### 8.7 Business Settings
- แก้ profile (name, industry, description, targetAudience, tone, keywords)
- เปลี่ยน logo
- ตั้งค่า auto-post (mode + cadence + fixed schedule)
- ลบธุรกิจ (ต้องยืนยัน 2 ครั้ง)

### 8.8 Service Management
- List (grid หรือ table)
- เพิ่ม/แก้/ลบ/เปิด-ปิด
- Modal สำหรับเพิ่ม/แก้

### 8.9 Facebook Connection
- ปุ่ม "เชื่อมต่อ Facebook" → redirect ไป OAuth
- หน้าเลือก page (หลัง OAuth callback)
- แสดงสถานะ (เชื่อมต่อแล้ว / ยังไม่ได้เชื่อมต่อ)
- ปุ่ม "ยกเลิกการเชื่อมต่อ"

---

## 9. Polling vs WebSocket (MVP)

ใน MVP **ใช้ polling เท่านั้น** (ไม่มี WebSocket)

- Dashboard → polling ทุก 30 วินาที
- Post Detail (ตอน pending_approval) → polling ทุก 10 วินาที
- หรือ refetch เมื่อ user กลับมาที่หน้า (focus event)

WebSocket อาจเพิ่มใน Phase 4

---

## 10. ตัวอย่าง React Hook

```typescript
// hooks/usePosts.ts
export function usePosts(businessId: string, status: PostStatus) {
  return useQuery({
    queryKey: ['posts', businessId, status],
    queryFn: async () => {
      const res = await api.get(`/businesses/${businessId}/posts`, {
        params: { status, limit: 20 }
      });
      return res.data;
    },
    refetchInterval: 30_000,  // poll ทุก 30 วินาที
  });
}

// hooks/useApprovePost.ts
export function useApprovePost() {
  return useMutation({
    mutationFn: async ({
      postId, caption, scheduledAt
    }: {
      postId: string;
      caption?: string;
      scheduledAt?: string;
    }) => {
      const res = await api.post(`/posts/${postId}/approve`, {
        caption, scheduledAt
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    }
  });
}
```

---

## 11. อ่านเพิ่มเติม

- [`API.md`](../../API.md) — รายละเอียด endpoint ทั้งหมด
- [`userflow.md`](../../userflow.md) — flow ทั้งหมดที่ user จะเจอ
- [`docs/03-POST-LIFECYCLE.md`](../03-POST-LIFECYCLE.md) — state machine

---

## 12. ติดต่อ / สอบถาม

- **Backend dev:** [ชื่อทีม] (ดูจาก `docs/01-OVERVIEW.md`)
- **Channel:** [Slack/Discord/etc.]
- **Issue tracking:** [GitHub Issues URL]

อัปเดตล่าสุด: 2026-06-27
