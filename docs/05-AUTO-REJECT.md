# 05. Auto-Reject (ปฏิเสธอัตโนมัติเมื่อหมดเวลา)

> เอกสารนี้อธิบาย flow การปฏิเสธอัตโนมัติเมื่อ user ไม่อนุมัติโพสต์ทันเวลา

---

## 1. ปัญหา

ถ้า AI สร้างโพสต์ให้แล้ว ส่งอีเมลแจ้ง user แล้ว แต่ user **ลืม/ไม่ว่าง/ไม่อนุมัติ** จนเลยเวลา `scheduled_at` ที่ AI แนะนำ — จะเกิดอะไรขึ้น?

**คำตอบเดิม:** โพสต์ค้างใน `pending_approval` ไม่มีใครจัดการ → user งง, ระบบรก

**คำตอบใหม่:** Auto-reject — Backend จะ mark เป็น `expired` อัตโนมัติ

---

## 2. Flow

```
06:30 — Email "โพสต์พร้อมตรวจสอบ" ส่งถึง user
         user.approval_deadline = scheduled_at = 18:00
              ↓
06:30–18:00 — รอ user
              ↓ (อาจ)
         ┌────┴────┬─────────┐
         │         │         │
       approve   reject   ไม่ทำอะไร
         │         │         │
         ▼         ▼         ▼
      approved  rejected   18:00 — Cron expire
      (รอ dispatch)        ↓
                       status = 'expired'
                       rejection_reason = 'timeout'
                          ↓
                       Email "โพสต์ถูกข้าม"
```

---

## 3. Cron `expire-pending-approvals`

### 3.1 ตารางเวลา

**ทุก 1 นาที** (`* * * * *`)

### 3.2 Logic

```sql
-- หา posts ที่หมดเวลา
SELECT * FROM posts
WHERE status = 'pending_approval'
  AND approval_deadline <= NOW()
  AND deleted_at IS NULL;

-- สำหรับแต่ละ post (transaction):
UPDATE posts
SET status = 'expired',
    rejection_reason = 'timeout',
    updated_at = NOW()
WHERE id = $1;

-- Insert notification
INSERT INTO notifications (user_id, post_id, type, channel)
VALUES ($1, $1, 'post_expired', 'email');

-- Enqueue email
```

### 3.3 ไฟล์: `src/scheduler/expire-pending-approvals.cron.ts`

```typescript
@Cron(CronExpression.EVERY_MINUTE)
async expirePendingApprovals() {
  const expired = await this.postsRepo
    .createQueryBuilder('p')
    .setLock('pessimistic_write')  // กัน race กับ approve
    .where('p.status = :status', { status: 'pending_approval' })
    .andWhere('p.approval_deadline <= NOW()')
    .andWhere('p.deleted_at IS NULL')
    .getMany();

  for (const post of expired) {
    await this.dataSource.transaction(async (tx) => {
      PostStateMachine.transition(post, 'expired');
      post.rejection_reason = 'timeout';
      await tx.save(post);

      await tx.insert(Notification, {
        userId: post.business.ownerId,
        postId: post.id,
        type: 'post_expired',
        channel: 'email',
      });
    });

    await this.emailQueue.add('post-expired', { postId: post.id });
  }
}
```

---

## 4. Deadline

### 4.1 กำหนด `approval_deadline` ตอนไหน

ตอนสร้าง post (status `generating` → `pending_approval`):

```typescript
post.scheduled_at = ai.suggestedScheduledAt;
post.approval_deadline = ai.suggestedScheduledAt;  // = scheduled_at
```

### 4.2 Deadline = scheduled_at

- ไม่มี buffer (เช่น ไม่หัก 5 นาทีก่อน)
- เพราะ dispatcher รันทุก 1 นาที → race condition น้อยมาก
- ถ้า user approve ก่อน scheduled_at → dispatcher จะ pick up ทันที
- ถ้า user approve หลัง scheduled_at → status = `approved` แต่ scheduled_at < now → dispatcher จะ post ทันที (ทำงานถูกต้อง)

---

## 5. Email ที่ส่ง

### Template: `post-expired`

**Subject:** โพสต์ถูกข้ามเนื่องจากไม่ได้อนุมัติทันเวลา

**Body:**
```
สวัสดีครับ/ค่ะ

โพสต์ที่ AI แนะนำสำหรับ "ร้านก๋วยเตี๋ยวลุงมา" ในวันที่ 27 มิ.ย. 2569
ไม่ได้รับการอนุมัติทันเวลา (18:00) ระบบจึงข้ามโพสต์นี้ไป

แคปชั่น: "ศุกร์นี้พบกับโปรโปรโมชันสุดคุ้ม!..."

คุณสามารถสร้างโพสต์ใหม่ได้ที่ปุ่ม "+ สร้างโพสต์ด้วยตนเอง"
หรือรอ AI ตัดสินใจใหม่ในเช้าวันพรุ่งนี้ (06:00)

[ไปที่ Dashboard]
```

---

## 6. สิ่งที่ต้องระวัง

### 6.1 Race Condition กับ `approve`

**ปัญหา:** User กด "อนุมัติ" พร้อมกับ expire cron ทำงาน

**วิธีป้องกัน:**
- ใช้ `SELECT ... FOR UPDATE` ใน transaction ทั้งสองฝั่ง
- ฝั่ง approve: lock row → check status → update
- ฝั่ง expire: lock row → check status → update

**ผลลัพธ์:**
- ถ้า approve ชนะ → expire cron เห็น status = 'approved' แล้ว → ไม่ทำอะไร
- ถ้า expire ชนะ → approve ได้ 409 `invalid_state`

### 6.2 Race Condition กับ `dispatch`

**ปัญหา:** Expire cron + dispatch cron รันใกล้กัน (scheduled_at = now)

**ลำดับ:**
- `dispatch-due-posts` query: `status = 'approved' AND scheduled_at <= now`
- `expire-pending-approvals` query: `status = 'pending_approval' AND approval_deadline <= now`

→ ไม่ทับซ้อน (filter status ต่างกัน) → ไม่มี race

### 6.3 User แก้ scheduledAt ตอน approve

```typescript
POST /posts/{id}/approve
{ scheduledAt: "2026-06-28T11:00:00.000Z" }
```

→ Backend update `scheduled_at = new` และ `approval_deadline = new` → expire cron ใช้ deadline ใหม่

---

## 7. ตัวเลขสถิติ (สำหรับ Dashboard ในอนาคต)

อาจ track ในอนาคต (Phase 4):
- จำนวน expired posts ต่อสัปดาห์
- สัดส่วน approved : rejected : expired
- เวลาเฉลี่ยที่ user ใช้ approve (นับจาก email sent)

---

## 8. อ่านเพิ่มเติม

- [`03-POST-LIFECYCLE.md`](./03-POST-LIFECYCLE.md) — state machine
- [`02-DATA-MODEL.md`](./02-DATA-MODEL.md) — `posts.rejection_reason`
- [`contracts/FRONTEND.md`](./contracts/FRONTEND.md) — UI แสดง expired

อัปเดตล่าสุด: 2026-06-27
