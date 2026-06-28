# 🎨 ERP-AI — Frontend (Next.js Application)

ส่วนแสดงผลผู้ใช้งาน (Frontend) พัฒนาด้วยเฟรมเวิร์ก **Next.js (App Router)** ร่วมกับ **TypeScript**, **Tailwind CSS v4** และฐานคอมโพเนนต์จาก **shadcn/ui**

---

## 🚀 ฟังก์ชันการใช้งานปัจจุบัน (Phase 1 & 2 Complete)

ปัจจุบันในระบบได้พัฒนาฟีเจอร์ฝั่งหน้าบ้านเสร็จสิ้นถึง **Phase 2** แล้ว:

### 🔐 Phase 1: Foundation & Authentication
1. **Routing Gatekeeper (`/`):** ตรวจสอบและดักสิทธิ์บัญชีผู้ใช้ ส่งตัวไปยังหน้าล็อกอิน หรือสลับหน้าเข้าระหว่างวิซาร์ดเริ่มต้น (`/onboarding`) หรือหน้าแดชบอร์ดหลัก (`/dashboard`)
2. **ระบบสิทธิ์เข้าใช้งาน:** หน้า Login, Register, Forgot Password และ Reset Password ที่มีระบบตรวจสอบความถูกต้องฟอร์มด้วย Zod ครบครัน
3. **ความปลอดภัยโทเค็น:** เก็บ Access Token ใน Zustand Memory และจัดการ Refresh Token หมุนเวียนอัตโนมัติ (Silent Refresh Interceptor)

### 📋 Phase 2: Onboarding Wizard (ระบบตั้งค่าแบรนด์ร้านค้าเริ่มต้น)
1. **หน้าตั้งค่าแบบวิซาร์ดสลับสเต็ป (`/onboarding`):** ควบคุมผ่าน URL Parameter (`?step=1-4`) เพื่อรักษาประวัติการกรอกข้อมูลไม่ให้หายหากกดรีเฟรชหน้าเว็บ
2. **สเต็ปที่ 1: ข้อมูลแบรนด์ธุรกิจ:** บันทึกชื่อ, ประเภท, คำอธิบายจุดขาย, กลุ่มเป้าหมาย, น้ำเสียงแบรนด์ (Tone), และคีย์เวิร์ดโฆษณา พร้อมระบบอัปโหลดภาพโลโก้แบรนด์
3. **สเต็ปที่ 2: ตั้งค่าการโพสต์อัจฉริยะ:** กำหนดความถี่การทำงานของ AI ทั้งแบบโพสต์อัจฉริยะ (`AI Decide`) และโหมดกำหนดเวลาตายตัว (`Fixed Schedule`) พร้อมตัวจัดการชิ้นงานตารางเวลาโพสต์
4. **สเต็ปที่ 3: คลังความรู้สินค้า/บริการ:** ดึงและแสดงสินค้าคงคลัง พร้อมเปิด Modal เพิ่มรูปภาพ รายละเอียด และราคาเสนอขาย (แปลงหน่วยจากเงินบาทเป็น สตางค์ อัตโนมัติก่อนส่งบันทึกหลังบ้าน)
5. **สเต็ปที่ 4: เชื่อมโยงบัญชีเผยแพร่:** บูรณาการระบบ Facebook OAuth และมีเส้นทางดักสลับส่งกลับ `/businesses/[id]` เพื่อตรวจจับการผูกสิทธิ์ แล้วแสดง Dropdown รายการเพจที่ได้รับสิทธิ์บริหารจัดการเพื่อให้ผู้ใช้กดตกลงเชื่อมต่อและเปิดระบบงานแดชบอร์ด

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
