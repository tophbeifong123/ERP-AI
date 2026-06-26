# ERP-AI

ระบบบริหารจัดการทรัพยากรองค์กร (ERP) อัจฉริยะที่ขับเคลื่อนด้วย AI พัฒนาด้วยเทคโนโลยีที่ทันสมัยและมีประสิทธิภาพสูง

## 🚀 โครงสร้างโปรเจกต์ (Project Structure)

โปรเจกต์นี้ถูกออกแบบในรูปแบบ Monorepo / Multi-service:

- **`frontend/`**: ส่วนเว็บแอปพลิเคชันสำหรับผู้ใช้ พัฒนาด้วย Next.js (App Router), TypeScript และ React
- **บริการอื่น ๆ ในอนาคต**: สำหรับ Backend APIs, บริการทางด้าน AI (AI Microservices) และอื่น ๆ

---

## 💻 ส่วนการแสดงผล (Frontend - Next.js)

ส่วน Frontend เป็นแอปพลิเคชัน Next.js ที่ออกแบบโครงสร้างมาเพื่อให้รองรับการขยายตัว (Scalability) เขียนโค้ดได้สะอาด และทำงานได้อย่างรวดเร็ว

### 🛠️ เทคโนโลยีและแนวทางปฏิบัติที่ดีที่สุด (Tech Stack & Best Practices)
- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19)
- **Language**: [TypeScript](https://www.typescriptlang.org/) เพื่อให้โค้ดมีความปลอดภัยในการระบุชนิดข้อมูล (Strict Type Safety)
- **Styling**: Vanilla CSS (เน้นความยืดหยุ่น ปรับแต่งตามหน้าจอได้ง่าย และหลีกเลี่ยงการใช้ Framework ตกแต่งที่มีขนาดใหญ่โดยไม่จำเป็น)
- **Linting & Formatting**: ESLint (ตั้งค่าตามมาตรฐานของ Next.js)

### 📂 โครงสร้างโฟลเดอร์ (ภายใต้ `frontend/`)
```
frontend/
├── src/
│   ├── app/            # App Router (หน้าเว็บ, Layout และ API Route Handlers)
│   │   ├── layout.tsx  # Layout หลักของแอป (กำหนด Fonts, Metadata และ Global States)
│   │   ├── page.tsx    # หน้าแรกของเว็บไซต์ (Homepage)
│   │   └── globals.css # ไฟล์สไตล์ส่วนกลาง (Global Styles)
│   ├── components/     # UI Components ที่สามารถนำมาใช้งานซ้ำได้ (Reusable Components)
│   └── lib/            # ฟังก์ชันช่วยเขียน, Custom Hooks, ฟังก์ชันเรียก API และ Types ต่างๆ
├── public/             # ไฟล์ Static (รูปภาพ, ไอคอน, ฟอนต์)
├── tsconfig.json       # การตั้งค่า TypeScript
└── next.config.ts      # การตั้งค่า Next.js
```

### ⚙️ เริ่มต้นใช้งาน (Getting Started)

#### สิ่งที่จำเป็นต้องมีก่อนเริ่ม (Prerequisites)
- Node.js (แนะนำเวอร์ชัน 18.17.0 ขึ้นไป)
- npm (มาพร้อมการติดตั้ง Node.js)

#### ขั้นตอนการติดตั้งและรันโปรเจกต์

1. ไปยังโฟลเดอร์ frontend:
   ```bash
   cd frontend
   ```

2. ติดตั้ง Dependencies (หากยังไม่ได้ติดตั้ง):
   ```bash
   npm install
   ```

3. รัน Development Server:
   ```bash
   npm run dev
   ```

4. เปิดบราวเซอร์และเข้าใช้งานที่ [http://localhost:3000](http://localhost:3000) เพื่อดูผลลัพธ์ของแอปพลิเคชัน

### 📝 คำสั่งต่าง ๆ (Scripts)
ภายในโฟลเดอร์ `frontend/` สามารถรันคำสั่งเหล่านี้ได้:
- `npm run dev` - เริ่มรันเซิร์ฟเวอร์สำหรับเขียนโปรแกรม (Development)
- `npm run build` - คอมไพล์โปรเจกต์เพื่อพร้อมใช้งานจริง (Production Build)
- `npm run start` - รันเซิร์ฟเวอร์โปรเจกต์ที่ผ่านการ Build แล้ว
- `npm run lint` - ตรวจสอบความถูกต้องและคุณภาพของโค้ดด้วย ESLint

---

## 🎨 มาตรฐานการเขียนโค้ดและการพัฒนา (Best Practices & Coding Standards)

เพื่อให้โค้ดมีความเป็นระเบียบ เรียบร้อย และดูแลรักษาได้ง่ายในระยะยาว ขอความร่วมมือปฏิบัติตามกฎต่อไปนี้:

1. **การจัดการ Routing และโฟลเดอร์**:
   - ใช้ Next.js **App Router** (`src/app`) สำหรับทุกหน้าเพจและการทำ Routing
   - เก็บ Component ที่ใช้งานเฉพาะเจาะจงในหน้านั้น ๆ ไว้ภายใต้โฟลเดอร์ของหน้านั้น และนำ Component ที่ใช้ร่วมกันหลายที่ไปเก็บไว้ที่ `src/components`

2. **การใช้งาน TypeScript**:
   - กำหนดประเภทข้อมูล (Type) ให้กับข้อมูลทุกตัว, Props ของ Component และผลลัพธ์จาก API เสมอ หลีกเลี่ยงการใช้ `any`
   - แนะนำให้ใช้ `interface` แทน `type` สำหรับการประกาศ API สาธารณะหรือ Props ของ Component

3. **การตกแต่งและ CSS**:
   - ออกแบบหน้าจอให้รองรับอุปกรณ์ทุกขนาด (Responsive) โดยใช้ Flexbox/Grid ใน `globals.css` หรือใช้ CSS Modules (`*.module.css`)
   - กำหนดค่าสี, ระยะห่าง (Spacing) และขนาดอักษรในรูปแบบ CSS Variables ไว้ใน `globals.css` เพื่อให้ทั้งเว็บเป็นธีมเดียวกัน

4. **การทำ SEO & Metadata**:
   - ใช้ Metadata API ของ Next.js เสมอ โดยการใส่ `title` และ `description` ที่อธิบายรายละเอียดของหน้านั้น ๆ ทั้งใน Layout หลัก และหน้าย่อยต่าง ๆ
   - ใช้แท็ก HTML5 เชิงความหมาย (Semantic HTML เช่น `<header>`, `<main>`, `<footer>`, `<section>`) เพื่อช่วยให้เว็บติด SEO ได้ดียิ่งขึ้น