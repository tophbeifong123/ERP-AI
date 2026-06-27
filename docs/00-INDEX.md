# สารบัญเอกสาร (Documentation Index)

> เอกสารทั้งหมดของโปรเจกต์ ERP-AI ฉบับภาษาไทย
> แยกตามกลุ่มผู้อ่าน

---

## เอกสารหลัก (สำหรับทุกคนในทีม)

| # | เอกสาร | คำอธิบาย |
|---|---|---|
| 00 | [INDEX](./00-INDEX.md) | สารบัญเอกสาร (ไฟล์นี้) |
| 01 | [OVERVIEW](./01-OVERVIEW.md) | ภาพรวมระบบ สถาปัตยกรรม ผู้รับผิดชอบ เทคโนโลยี |
| 02 | [DATA-MODEL](./02-DATA-MODEL.md) | Schema ฐานข้อมูล ER diagram migrations |
| 03 | [POST-LIFECYCLE](./03-POST-LIFECYCLE.md) | State machine ของโพสต์ และ transitions |
| 04 | [DAILY-DECISION](./04-DAILY-DECISION.md) | กฎการตัดสินใจของ AI Decision Service |
| 05 | [AUTO-REJECT](./05-AUTO-REJECT.md) | Flow auto-reject เมื่อไม่อนุมัติทันเวลา |
| 06 | [AUTH](./06-AUTH.md) | JWT refresh token internal token email verify |
| 07 | [OBSERVABILITY](./07-OBSERVABILITY.md) | Logging request ID /health Bull Board |

## Contract สำหรับทีม AI (อ่านก่อนเริ่มงาน)

| # | เอกสาร | สำหรับทีม |
|---|---|---|
| AI-DECISION | [contracts/AI-DECISION.md](./contracts/AI-DECISION.md) | marketing-ai dev (บริการตัดสินใจ) |
| AI-CAPTION | [contracts/AI-CAPTION.md](./contracts/AI-CAPTION.md) | marketing-ai dev (บริการสร้างคำบรรยาย) |
| AI-MEDIA | [contracts/AI-MEDIA.md](./contracts/AI-MEDIA.md) | ai-generate-media dev (image + short_video) |

## Contract สำหรับทีม Frontend

| # | เอกสาร | สำหรับทีม |
|---|---|---|
| FRONTEND | [contracts/FRONTEND.md](./contracts/FRONTEND.md) | frontend dev (Next.js) |

## เอกสารที่ root

| เอกสาร | คำอธิบาย |
|---|---|
| [README.md](../README.md) | ภาพรวมโปรเจกต์ stack team roles features |
| [API.md](../API.md) | API contract ฉบับเต็ม (ทุก endpoint) |
| [userflow.md](../userflow.md) | ทุก flow ที่ user จะเจอ ตั้งแต่สมัครจนใช้งาน |

---

## แนะนำลำดับการอ่าน

**ถ้าเป็น Backend dev** → 01 → 02 → 03 → 06 → 07 → ดู code
**ถ้าเป็น AI Decision / Caption dev** → 01 → 04 → contracts/AI-DECISION.md → contracts/AI-CAPTION.md
**ถ้าเป็น AI Media dev** → 01 → contracts/AI-MEDIA.md
**ถ้าเป็น Frontend dev** → 01 → userflow.md → contracts/FRONTEND.md → API.md

---

## สถานะเอกสาร

- ✅ ฉบับร่าง (Draft) — เขียนครบแล้ว รอ feedback
- ⏳ รอเขียน
- ❌ ไม่เกี่ยวข้อง

อัปเดตล่าสุด: 2026-06-27
