# 🎨 ERP-AI — Frontend (Next.js Application)

ส่วนแสดงผลผู้ใช้งาน (Frontend) พัฒนาด้วยเฟรมเวิร์ก **Next.js (App Router)** ร่วมกับ **TypeScript**, **Tailwind CSS v4** และฐานคอมโพเนนต์จาก **shadcn/ui**

---

## 🚀 ฟังก์ชันการใช้งานปัจจุบัน (Phase 1 Complete)

ปัจจุบันใน **Phase 1: Foundation & Authentication** ระบบได้วางรากฐานทางโครงสร้างและความปลอดภัยการใช้งานเรียบร้อยแล้ว:

1. **Routing Gatekeeper (`/`):** ตรวจสอบสถานะการเชื่อมต่อ API และสิทธิ์บัญชีผู้ใช้
   * หากไม่มีเซสชัน -> จะส่งตัวไปล็อกอิน (`/login`)
   * หากมีเซสชันและต่ออายุสำเร็จ -> จะยิงตรวจสอบธุรกิจร้านค้าเพื่อสลับหน้าจอระหว่างวิซาร์ดเริ่มต้น (`/onboarding`) หรือหน้าแดชบอร์ดหลัก (`/dashboard`)
2. **ระบบยืนยันตัวตน (Authentication Pages):**
   * **เข้าสู่ระบบ (`/login`):** รองรับฟอร์มและการแจ้งสถานะการยืนยันอีเมลสำเร็จ/ล้มเหลวจากลิงก์ทางอีเมล
   * **สมัครสมาชิก (`/register`):** รองรับฟอร์มและการสลับแสดงผลหน้าจอแจ้งการส่งอีเมลตรวจสอบ
   * **ลืมและเปลี่ยนรหัสผ่าน (`/forgot-password` & `/reset-password`):** รองรับการรับลิงก์ Token และเปลี่ยนรหัสผ่านใหม่แบบครอบคลุม
3. **การจัดการสิทธิ์ความปลอดภัยในตัว (Token Rotation & Memory Storage):**
   * บันทึก Access Token ใน Memory (Zustand) เพื่อความปลอดภัยสูงสุดจาก XSS
   * จัดเก็บและหมุนเวียน Refresh Token (Token Rotation) ด้วย Request/Response Interceptor ที่ฉลาดในการตรวจจับ 401 และต่ออายุตัวเองเบื้องหลังแบบ Silent Refresh

---

## 📂 โครงสร้างโฟลเดอร์ปัจจุบัน (Phase 1 Directory Structure)

การวางไฟล์ทำตามหลัก **Feature-Based & SoC (Separation of Concerns)** เพื่อรองรับการขยายตัวในเฟสต่อๆ ไป:

```
src/
├── app/                                # เส้นทางและการแสดงผลของ Next.js (Pages Layer)
│   ├── (auth)/                         # กลุ่มหน้าจอการยืนยันตัวตน (Login, Register, etc.)
│   │   ├── layout.tsx                  # ตกแต่ง UI หน้าจอ Auth ด้วย Glassmorphism & Gradients
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── globals.css                     # นำเข้า Tailwind v4 และกำหนด CSS variables
│   ├── layout.tsx                      # รูทเลย์เอาต์ ติดตั้งระบบ Notification ของ Sonner
│   └── page.tsx                        # หน้าแรกทำหน้าที่เป็น Routing Gatekeeper คัดกรองผู้ใช้งาน
├── components/                         # UI Presentation Layer (ส่วนการนำมาใช้ซ้ำ)
│   └── ui/                             # 14 อะตอมมิกคอมโพเนนต์จาก shadcn/ui (button, input, etc.)
├── core/                               # ข้อมูลแกนกลางและการติดต่อเซิร์ฟเวอร์ (Domain Layer)
│   ├── services/
│   │   ├── api-client.ts               # HTTP client ส่วนกลางพร้อมระบบดักจับต่ออายุโทเค็นอัตโนมัติ
│   │   └── auth-service.ts             # บริการและคำสั่งเชื่อมต่อ REST API ของกลุ่มสิทธิ์ผู้ใช้งาน
│   ├── types/
│   │   └── auth.ts                     # ประกาศ TypeScript interface ของผู้ใช้และ API response
│   └── validations/
│   │   └── auth-schema.ts              # Zod validation schema สำหรับฟอร์มทั้งหมดในกลุ่มล็อกอิน
└── hooks/                              # React hooks (State Management Layer)
    └── store/
        └── use-auth-store.ts           # จัดเก็บข้อมูล Access Token และโปรไฟล์ด้วย Zustand (In-memory)
```

---

## ⚙️ วิธีการเริ่มต้นใช้งาน (Getting Started)

### 1. คำสั่งรันโหมดพัฒนา (Development Mode)
```bash
# ติดตั้งไลบรารีที่จำเป็น
pnpm install

# รันเซิร์ฟเวอร์โหมดนักพัฒนา (ที่พอร์ต http://localhost:3001)
pnpm dev
```

### 2. คำสั่งตรวจสอบคุณภาพของโค้ด (Quality Assurance)
```bash
# ตรวจสอบคุณภาพโค้ดและ Linting (ต้องไม่มีข้อผิดพลาด)
pnpm lint

# ตรวจสอบการคอมไพล์ TypeScript และการรันสร้าง static routes
pnpm build
```
