'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';

import { loginSchema, LoginInput } from '../../../core/validations/auth-schema';
import { authService } from '../../../core/services/auth-service';
import { useAuthStore } from '../../../hooks/store/use-auth-store';
import { apiClient } from '../../../core/services/api-client';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  // ตรวจจับ Query Parameters จากอีเมลยืนยันตัวตนหรือการเปลี่ยนรหัสผ่าน
  useEffect(() => {
    const verified = searchParams.get('verified');
    const verifyError = searchParams.get('verify_error');
    const resetError = searchParams.get('reset_error');

    if (verified === '1') {
      toast.success('ยืนยันอีเมลสำเร็จ! กรุณาเข้าสู่ระบบเพื่อใช้งาน');
    } else if (verifyError === '1') {
      toast.error('ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุแล้ว');
    } else if (resetError) {
      toast.error('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน กรุณาลองใหม่อีกครั้ง');
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    try {
      // 1. เรียกใช้งาน API Login
      const response = await authService.login(data);
      
      // 2. จัดเก็บ Session ใน Zustand และ LocalStorage
      setAuth(response.user, response.accessToken);
      localStorage.setItem('refresh_token', response.refreshToken);
      
      toast.success('เข้าสู่ระบบสำเร็จ');

      // 3. ตรวจสอบว่าผู้ใช้มีธุรกิจลงทะเบียนไว้แล้วหรือยัง
      try {
        const businessCheck = await apiClient.get<{ businesses: unknown[] }>('/businesses');
        if (businessCheck.data.businesses && businessCheck.data.businesses.length > 0) {
          router.replace('/dashboard');
        } else {
          router.replace('/onboarding');
        }
      } catch {
        // หากดึงข้อมูลธุรกิจไม่ผ่าน (เช่น ยังไม่กดยืนยันอีเมล) ให้ค้างไว้ที่หน้า onboarding หรือให้ระบบจัดการต่อ
        router.replace('/onboarding');
      }
    } catch (error) {
      let errMsg = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      if (axios.isAxiosError(error) && error.response?.data) {
        errMsg = (error.response.data as { message?: string })?.message || errMsg;
      }
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-bold text-white">เข้าสู่ระบบ</h2>
        <p className="text-xs text-neutral-400">
          เพื่อจัดการเพจร้านค้าและโพสต์อัตโนมัติด้วย AI
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-medium text-neutral-300">
            อีเมลร้านค้า
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            disabled={isLoading}
            className="h-10 bg-neutral-900 border-neutral-800 text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-medium text-neutral-300">
              รหัสผ่าน
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              ลืมรหัสผ่าน?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              disabled={isLoading}
              className="h-10 pr-10 bg-neutral-900 border-neutral-800 text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 focus:outline-none"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>กำลังตรวจสอบ...</span>
            </>
          ) : (
            <>
              <span>เข้าสู่ระบบ</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>

      {/* Footer Link */}
      <div className="text-center text-xs text-neutral-400 pt-2 border-t border-neutral-800/60">
        ยังไม่มีบัญชีร้านค้า?{' '}
        <Link
          href="/register"
          className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
        >
          สมัครใช้งานฟรี
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-xs text-neutral-400">กำลังโหลดระบบเข้าสู่ระบบ...</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

