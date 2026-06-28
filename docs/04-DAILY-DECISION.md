# 04. Daily AI Decision (กฎการตัดสินใจของ AI)

> เอกสารนี้อธิบายว่า AI Decision Service ตัดสินใจอย่างไรว่า "วันนี้ควรโพสต์หรือไม่" และเลือกเวลา/ประเภท/บริการอย่างไร
> สำหรับทีม **marketing-ai dev** ที่จะ implement AI Decision Service

---

## 1. ภาพรวม

**ทุกวันเวลา 06:00 น.** Backend จะส่งงาน "ตัดสินใจ" ไปให้ AI Decision Service สำหรับทุกธุรกิจที่เปิด `auto_post_enabled = true` และ `auto_post_mode = 'ai_decide'`

AI จะตอบกลับว่า:
- `shouldPost: true` → พร้อม `suggestedScheduledAt`, `postType`, `featuredServiceIds`, `captionHint`
- `shouldPost: false` → พร้อมเหตุผล

---

## 2. Input ที่ AI ได้รับ

(ดู payload ฉบับเต็มใน [`contracts/AI-DECISION.md`](./contracts/AI-DECISION.md))

**สรุปสั้นๆ:**
```json
{
  "business": {
    "id": "uuid",
    "name": "...",
    "industry": "...",
    "tone": "...",
    "keywords": [...],
    "targetAudience": "คนทำงานออฟฟิศ 25-45 ปี",
    "postsPerWeekTarget": 3,
    "minGapDays": 1
  },
  "recentPosts": [...],         // โพสต์ 14 วันล่าสุด
  "postsThisWeek": 2,           // จำนวนโพสต์สัปดาห์นี้
  "lastPostAt": "2026-06-24T13:00:00.000Z",
  "nowIso": "2026-06-27T06:00:00.000Z"
}
```

---

## 3. เกณฑ์การตัดสินใจ `shouldPost`

### 3.1 Decision Tree

```
              postsThisWeek < postsPerWeekTarget ?
                         │
              ┌──────────┴──────────┐
              │ NO                  │ YES
              ▼                     ▼
        shouldPost = false    ระยะห่างจาก lastPostAt
        (โพสต์ครบแล้ว)       ≥ minGapDays ?
                                    │
                          ┌─────────┴─────────┐
                          │ NO                │ YES
                          ▼                   ▼
                    shouldPost = false    shouldPost = true
                    (ห่างไม่พอ)         (พร้อมโพสต์)
```

### 3.2 กฎเพิ่มเติม

**แม้ว่าเงื่อนไขข้างบนจะผ่าน** AI อาจตัดสิน `shouldPost = false` ได้ ถ้า:
- วันนี้เป็น **วันหยุดนักขัตฤกษ์ไทย** และ target audience เป็นกลุ่มที่อาจไม่ active (เช่น วันสงกรานต์ คนกลับบ้าน)
- โพสต์ล่าสุด 3 รายการเป็น `postType` เดียวกัน → ควรข้ามเพื่อกระจายความหลากหลาย
- `lastPostAt` ห่างจาก `now` < 12 ชั่วโมง (กันโพสต์ซ้ำเร็วเกินไป)

**ตัวอย่าง reasoning:**
- ✅ "โพสต์ 2 ครั้งในสัปดาห์นี้ ห่างจากโพสต์ล่าสุด 3 วัน ควรโพสต์วันนี้เพื่อรักษาความถี่"
- ❌ "โพสต์ครบ 3 ครั้ง/สัปดาห์แล้ว"
- ❌ "โพสต์ล่าสุดเพิ่งผ่านไป 8 ชั่วโมง ควรรอให้ถึง minGapDays"
- ❌ "วันนี้เป็นวันสงกรานต์ target audience น่าจะไม่ active"

---

## 4. เกณฑ์การเลือก `suggestedScheduledAt`

### 4.1 Time Zone

- AI คำนวณใน **Asia/Bangkok (UTC+7)**
- แปลงเป็น **UTC** ก่อนส่งกลับ
- เช่น 18:00 BKK → 11:00 UTC

### 4.2 Audience-based Defaults

วิเคราะห์จาก `targetAudience`:

| targetAudience (ตัวอย่าง) | เวลาที่แนะนำ (BKK) | เหตุผล |
|---|---|---|
| "คนทำงานออฟฟิศ 25-45" | 18:00-20:00 | เลิกงาน เช็ค FB ตอนเย็น |
| "วัยรุ่น 18-25" | 20:00-22:00 | active ช่วงกลางคืน |
| "ผู้ปกครอง 30-50" | 09:00-11:00 หรือ 19:00-21:00 | เช้าหลังส่งลูก / เย็นหลังเลิกเรียน |
| "B2B / นักธุรกิจ" | 08:00-09:00 หรือ 12:00-13:00 | เช้าก่อนประชุม / กลางวันพักเที่ยง |
| "นักท่องเที่ยว" | 10:00-12:00 หรือ 15:00-17:00 | วางแผนเที่ยว / พักบ่าย |

### 4.3 กฎเพิ่มเติม

- **หลีกเลี่ยง:** 23:00-06:00 (คนนอน), 13:00-14:00 (พักเที่ยง คนไม่เช็ค FB)
- **หลีกเลี่ยง:** เวลาที่มีโพสต์ของธุรกิจอื่นๆ พร้อมกัน (optional, ยากที่จะรู้)
- **ต้องเป็นอนาคต:** `suggestedScheduledAt` > `nowIso`
- **ควรเป็นวันนี้** (ถ้าเป็นไปได้) — เพราะ cron นี้รันตอน 06:00 และ user มีเวลาเห็นและอนุมัติทัน

### 4.4 ใช้ 06:00 เป็น baseline

- เนื่องจาก cron รัน 06:00 → ควรให้เวลาโพสต์ ≥ 06:00 + 2 ชั่วโมง (08:00 BKK = 01:00 UTC)
- **เวลาที่แนะนำ: 09:00-21:00 BKK ของวันนี้**

---

## 5. เกณฑ์การเลือก `postType`

### 5.1 Post Types

| Value | ความหมาย | เหมาะกับ |
|---|---|---|
| `promotion` | โปรโมชั่น/ลดราคา | กระตุ้นยอดขาย |
| `product_showcase` | แสดงสินค้า/บริการ | สร้างการรับรู้ |
| `brand_awareness` | สร้างอัตลักษณ์แบรนด์ | ระยะยาว |
| `event` | อีเวนต์/กิจกรรม | engagement |

### 5.2 หลักการเลือก

1. **หลีกเลี่ยงการซ้ำ:** ดูโพสต์ 3 รายการล่าสุด
   - ถ้าล่าสุดเป็น `promotion` → รอบนี้ไม่ควรเป็น `promotion`
2. **สลับระหว่าง hard-sell กับ soft-sell:**
   - `promotion` → ตามด้วย `product_showcase` หรือ `brand_awareness`
   - หลีกเลี่ยงการโพสต์ `promotion` ติดกัน
3. **ดู keyword + description ของ featured services** เพื่อเลือกประเภทที่เหมาะสม

### 5.3 Default Pattern

```
promotion → product_showcase → brand_awareness → (วนซ้ำ)
event → (แทรกเมื่อมีอีเวนต์จริง)
```

---

## 6. เกณฑ์การเลือก `featuredServiceIds`

### 6.1 กฎ

- เลือก 1-3 services
- ต้อง `isActive = true`
- ไม่ซ้ำกับโพสต์ 3 รายการล่าสุด (ถ้าเป็นไปได้)
- ตรงกับ `postType` ที่เลือก:
  - `promotion` → เลือก service ที่มี description เน้น "ลด", "โปรโมชัน"
  - `product_showcase` → เลือก service ที่ยังไม่เคย featured
  - `brand_awareness` → เลือก service ที่เป็น signature ของแบรนด์

### 6.2 Fallback

- ถ้าไม่มี service ที่ตรงเงื่อนไข → เลือก service ที่ created ล่าสุด (ยังไม่เคย featured)

---

## 7. เกณฑ์การเขียน `captionHint`

- ใช้เป็น "คำแนะนำ" ให้ AI Caption Service (ไม่ใช่ caption จริง)
- ความยาว ≤ 100 ตัวอักษร
- ภาษาไทย
- ตัวอย่าง:
  - "โปรโมชันวันศุกร์ เน้นก๋วยเตี๋ยวต้มยำ"
  - "แสดงเมนูใหม่: ข้าวผัดปู"
  - "เล่าเรื่องราวเบื้องหลังร้าน 30 ปี"

---

## 8. ตัวอย่าง Decision

### ตัวอย่างที่ 1: ควรโพสต์

```json
{
  "shouldPost": true,
  "reasoning": "โพสต์ 2 ครั้งในสัปดาห์นี้ เป้า 3 ครั้ง/สัปดาห์ ห่างจากโพสต์ล่าสุด 3 วัน (เกิน minGapDays 1 วัน) ควรโพสต์วันนี้เพื่อรักษาความถี่",
  "suggestedScheduledAt": "2026-06-27T11:00:00.000Z",  // 18:00 BKK
  "postType": "promotion",                              // ล่าสุดเป็น product_showcase
  "featuredServiceIds": ["b1c2d3e4-..."],               // เลือก service ที่ยังไม่ featured
  "captionHint": "โปรโมชันวันศุกร์ เน้นก๋วยเตี๋ยวต้มยำ"
}
```

### ตัวอย่างที่ 2: ข้ามวันนี้

```json
{
  "shouldPost": false,
  "reasoning": "โพสต์ครบ 3 ครั้ง/สัปดาห์แล้ว (postsThisWeek = 3, target = 3) ไม่ควรเพิ่ม"
}
```

### ตัวอย่างที่ 3: ข้ามเพราะห่างไม่พอ

```json
{
  "shouldPost": false,
  "reasoning": "โพสต์ล่าสุดเมื่อ 8 ชั่วโมงที่แล้ว ยังไม่ถึง minGapDays (1 วัน) ควรรอ"
}
```

---

## 9. Error Handling

AI ต้องตอบกลับด้วย error object (ไม่ใช่ HTTP error) ในกรณี:

| `error.code` | ความหมาย | Backend ทำอะไร |
|---|---|---|
| `internal_error` | ขัดข้อง | retry 3 ครั้ง (1m, 5m, 15m) |
| `timeout` | ประมวลผลนานเกิน 10 นาที | retry 3 ครั้ง |
| `invalid_input` | Input ผิดพลาด (เช่น business ไม่มีอยู่) | ไม่ retry, log error |

**ถ้า fail 3 ครั้ง:** content_plans.status = 'cancelled' (AI fail) → รอ cron รอบถัดไป (วันพรุ่งนี้ 06:00)

---

## 10. Testing

Backend จะมี endpoint `POST /internal/test/ai-decision-mock` (เฉพาะ dev) เพื่อให้:
- ทดสอบ callback โดยไม่ต้องเปิด AI service จริง
- ใช้ใน integration test

---

## 11. อ่านเพิ่มเติม

- [`contracts/AI-DECISION.md`](./contracts/AI-DECISION.md) — API contract
- [`01-OVERVIEW.md`](./01-OVERVIEW.md) — Flow หลัก
- [`02-DATA-MODEL.md`](./02-DATA-MODEL.md) — `content_plans` schema

อัปเดตล่าสุด: 2026-06-27
