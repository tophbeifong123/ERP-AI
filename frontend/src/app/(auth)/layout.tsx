import React from "react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout สำหรับหน้าย่อยของระบบ Authentication (Login, Register, etc.)
 * ออกแบบในสไตล์ Modern Glassmorphism และ Gradients แสงสว่างสดใสเพื่อความพรีเมียม
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background font-sans selection:bg-indigo-500/30 selection:text-white">
      {/* Background Decorative Gradients (ไฟเรืองแสงพื้นหลัง) */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

      {/* Content wrapper */}
      <div className="relative w-full max-w-md p-4 z-10">
        {/* Logo / Brand Header */}
        <div className="text-center mb-6 animate-fade-in">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white font-extrabold text-xl shadow-lg shadow-indigo-500/20 mb-3 select-none">
            EA
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            ERP<span className="text-indigo-400 font-extrabold">.AI</span>
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            แพลตฟอร์มจัดการ Facebook & LINE สำหรับ Thai SMEs
          </p>
        </div>

        {/* Card Component (ใช้ประโยชน์จาก Utility Classes ใหม่เพื่อความพรีเมียม) */}
        <div className="glass-panel glow-indigo rounded-2xl p-6 md:p-8 shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
