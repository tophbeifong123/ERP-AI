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

## 📂 โครงสร้างโฟลเดอร์ระบบ (Directory Structure)

การวางตำแหน่งโฟลเดอร์และไฟล์ ถูกออกแบบตามหลัก **Clean Architecture** และ **SoC (Separation of Concerns)** เพื่อความยืดหยุ่นในการพัฒนาและขยายระบบในระยะยาว:

```
src/
├── app/                                # Routing Layer (Next.js App Router)
│   ├── (auth)/                         # กลุ่มหน้าจอเข้าสู่ระบบและยืนยันตัวตน (Login, Register, etc.)
│   │   ├── layout.tsx                  # หน้ากากตกแต่งหน้าระบบ Auth ด้วย Glassmorphic
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── globals.css                     # นำเข้า Tailwind v4 และกำหนดสีสันสไตล์หลักของระบบ
│   ├── layout.tsx                      # รูทเลย์เอาต์หลัก ติดตั้ง Toaster แจ้งเตือน
│   └── page.tsx                        # หน้าแรกรับหน้าที่เป็น Routing Gatekeeper คัดแยกเส้นทางอัตโนมัติ
├── components/                         # UI Presentation Layer (คอมโพเนนต์นำมาใช้ซ้ำ)
│   ├── ui/                             # คอมโพเนนต์พื้นฐานจาก shadcn/ui (14 ตัวแรก)
│   ├── layouts/                        # โครงสร้างหลักในการนำทาง (Sidebar, Navbar, Switcher)
│   ├── shared/                         # คอมโพเนนต์แชร์ทั่วไป (Countdown, Player)
│   └── features/                       # คอมโพเนนต์เฉพาะทางธุรกิจ (ตารางแสดงผลโพสต์, ฟอร์มบันทึกบริการ)
├── core/                               # Domain & API Logic Layer
│   ├── services/
│   │   ├── api-client.ts               # Core Axios Client พร้อม Interceptors ดักหมุนโทเค็น
│   │   └── auth-service.ts             # API Call สำหรับการจัดการบัญชีผู้ใช้งาน
│   ├── types/
│   │   └── auth.ts                     # ประกาศ Interface และ DTO ของระบบยืนยันตัวตน
│   └── validations/
│       └── auth-schema.ts              # Zod schema สำหรับตรวจเช็คฟอร์มล็อกอิน/สมัครสมาชิก
├── hooks/                              # React Hooks & State Management
│   ├── store/
│   │   └── use-auth-store.ts           # จัดเก็บ Access Token ใน Memory ด้วย Zustand
│   └── queries/                        # (กำลังจะเพิ่มใน Phase 3) React Query สำหรับดักแคชข้อมูลฝั่งเซิร์ฟเวอร์
└── lib/                                # Library & Helper Utilities (utils.ts, formatters)
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
