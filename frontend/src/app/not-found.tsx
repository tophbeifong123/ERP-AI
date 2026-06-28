// src/app/not-found.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, Compass, HelpCircle } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-[150px] pointer-events-none" />

      {/* Main Content Container */}
      <div className="max-w-md w-full text-center relative z-10 space-y-6">
        
        {/* Animated Icon & Error Code */}
        <div className="relative inline-flex items-center justify-center mb-2">
          {/* Outer glowing border ring */}
          <div className="absolute inset-0 rounded-full border border-white/8 bg-white/2 blur-[8px] scale-110 pointer-events-none" />
          
          <div className="w-24 h-24 rounded-full border border-white/12 bg-white/3 flex items-center justify-center relative">
            <Compass className="w-12 h-12 text-indigo-400" style={{ animation: 'spin 12s linear infinite' }} />
            <HelpCircle className="w-6 h-6 text-purple-400 absolute top-2 right-2 animate-bounce" />
          </div>
        </div>

        {/* Big 404 Heading */}
        <div className="space-y-2">
          <h1 className="text-8xl font-black tracking-tighter bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-sm select-none">
            404
          </h1>
          <h2 className="text-xl font-bold text-foreground">ไม่พบหน้าเว็บที่คุณต้องการ</h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
            หน้าเว็บที่คุณกำลังพยายามเข้าถึงอาจถูกลบออก ย้ายตำแหน่งชั่วคราว หรือคุณอาจกรอกสะกดชื่อ URL ผิดพลาด โปรดตรวจสอบความถูกต้องอีกครั้ง
          </p>
        </div>

        {/* Control Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={() => router.back()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-white/8 bg-white/3 hover:bg-white/8 text-xs font-bold text-foreground transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            ย้อนกลับหน้าก่อนหน้า
          </button>
          
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-xs font-bold text-white shadow shadow-primary/25 transition cursor-pointer"
          >
            <Home className="w-4 h-4" />
            กลับสู่หน้า Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
}
