'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useAuthStore } from '../hooks/store/use-auth-store';
import { apiClient } from '../core/services/api-client';
import { authService } from '../core/services/auth-service';

/**
 * Gatekeeper Router Page (หน้าแรกหลักของเว็บระบบ)
 * ทำหน้าที่คัดกรองสิทธิ์และคัดแยกหน้าจอที่เหมาะสมกับสถานะของผู้ใช้อัตโนมัติ (Best Practice)
 */
export default function HomePage() {
  const router = useRouter();
  const { setAuth, clearAuth } = useAuthStore();
  const [statusMessage, setStatusMessage] = useState('กำลังเชื่อมต่อระบบ...');

  useEffect(() => {
    const checkAuthenticationAndRedirect = async () => {
      // 1. ตรวจสอบว่าใน LocalStorage มี Refresh Token หรือไม่
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (!refreshToken) {
        // ไม่มี Refresh Token หมายถึงเป็นผู้ใช้ใหม่หรือ Session หมดอายุถาวร -> ไปหน้าล็อกอิน
        router.replace('/login');
        return;
      }

      try {
        setStatusMessage('กำลังตรวจสอบสิทธิ์การใช้งาน...');

        // 2. ดึงข้อมูลประวัติโปรไฟล์ของฉัน (/me) 
        // หาก Access Token ใน Memory หายไป Interceptor จะทำการยิง Refresh Token ให้อัตโนมัติในเบื้องหลัง
        const user = await authService.getMe();
        
        // ดึงโทเค็นล่าสุดที่เพิ่งอัปเดตจาก Interceptor มาอัปเดต Store (ในกรณีเพิ่งรีโหลดหน้าจอใหม่)
        const currentAccessToken = useAuthStore.getState().accessToken;
        if (currentAccessToken) {
          setAuth(user, currentAccessToken);
        }

        setStatusMessage('ตรวจสอบร้านค้าของท่าน...');

        // 3. ตรวจสอบจำนวนธุรกิจร้านค้าที่ลงทะเบียนไว้
        const businessCheck = await apiClient.get<{ businesses: unknown[] }>('/businesses');
        
        if (businessCheck.data.businesses && businessCheck.data.businesses.length > 0) {
          // มีธุรกิจแล้ว -> นำเข้าสู่หน้าแดชบอร์ดหลัก
          router.replace('/dashboard');
        } else {
          // ยังไม่มีธุรกิจ -> นำไปหน้าวิซาร์ด Onboarding เพื่อตั้งค่าข้อมูลร้านแรก
          router.replace('/onboarding');
        }
      } catch {
        // หากกระบวนการตรวจสอบสิทธิ์ล้มเหลว (เช่น Refresh Token หมดอายุแล้วจริง)
        clearAuth();
        localStorage.removeItem('refresh_token');
        router.replace('/login');
      }
    };

    checkAuthenticationAndRedirect();
  }, [router, setAuth, clearAuth]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-background font-sans">
      {/* Background Decorative Lighting */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none" />

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

      {/* Loader UI */}
      <div className="flex flex-col items-center justify-center space-y-4 z-10">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white font-extrabold text-xl shadow-lg shadow-indigo-500/10 mb-2 select-none animate-pulse">
          EA
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          <span className="text-sm font-medium text-neutral-300">{statusMessage}</span>
        </div>
      </div>
    </div>
  );
}
