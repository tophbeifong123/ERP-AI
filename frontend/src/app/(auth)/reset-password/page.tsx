'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';

import { resetPasswordSchema, ResetPasswordInput } from '../../../core/validations/auth-schema';
import { authService } from '../../../core/services/auth-service';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // แจ้งเตือนเมื่อไม่พบ Token
  useEffect(() => {
    if (!token) {
      toast.error('ไม่พบลิงก์ยืนยันตัวตนตั้งค่ารหัสผ่านใหม่');
    }
  }, [token]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    if (!token) {
      toast.error('ไม่สามารถเปลี่ยนรหัสผ่านได้เนื่องจากไม่มี Token');
      return;
    }

    setIsLoading(true);
    try {
      // 1. เรียกใช้งาน API Reset Password
      await authService.resetPassword(token, {
        newPassword: data.newPassword,
      });
      
      toast.success('เปลี่ยนรหัสผ่านใหม่สำเร็จแล้ว');
      setIsSuccess(true);
    } catch (error) {
      let errMsg = 'ลิงก์เปลี่ยนรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว';
      if (axios.isAxiosError(error) && error.response?.data) {
        errMsg = (error.response.data as { message?: string })?.message || errMsg;
      }
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-6 text-center py-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 text-red-400 mb-2">
          <LockKeyhole className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-white">ลิงก์ไม่ถูกต้อง</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
            ไม่พบ Token ที่ใช้ในการระบุตัวตนสำหรับการเปลี่ยนรหัสผ่านใหม่ หรือลิงก์กู้คืนข้อมูลของคุณอาจไม่สมบูรณ์
          </p>
        </div>
        <div className="pt-2">
          <Link href="/login" className="inline-block w-full">
            <Button className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all">
              กลับไปหน้าเข้าสู่ระบบ
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="space-y-6 text-center py-4 animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 mb-2">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-white">ตั้งรหัสผ่านใหม่สำเร็จ!</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
            เปลี่ยนรหัสผ่านใหม่ของคุณเรียบร้อยแล้ว คุณสามารถใช้รหัสผ่านใหม่นี้เข้าสู่ระบบระบบได้ทันที
          </p>
        </div>
        <div className="pt-2">
          <Link href="/login" className="inline-block w-full">
            <Button className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]">
              เข้าสู่ระบบตอนนี้
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-bold text-white">ตั้งรหัสผ่านใหม่</h2>
        <p className="text-xs text-neutral-400">
          กรุณากำหนดรหัสผ่านใหม่ที่คุณจำได้ง่ายและมีความปลอดภัย
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* New Password Field */}
        <div className="space-y-2">
          <Label htmlFor="newPassword" className="text-xs font-medium text-neutral-300">
            รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)
          </Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              disabled={isLoading}
              className="h-10 pr-10 bg-neutral-900 border-neutral-800 text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              {...register('newPassword')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 focus:outline-none"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.newPassword && (
            <p className="text-xs text-red-500 mt-1">{errors.newPassword.message}</p>
          )}
        </div>

        {/* Confirm New Password Field */}
        <div className="space-y-2">
          <Label htmlFor="confirmNewPassword" className="text-xs font-medium text-neutral-300">
            ยืนยันรหัสผ่านใหม่
          </Label>
          <div className="relative">
            <Input
              id="confirmNewPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="••••••••"
              disabled={isLoading}
              className="h-10 pr-10 bg-neutral-900 border-neutral-800 text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              {...register('confirmNewPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 focus:outline-none"
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmNewPassword && (
            <p className="text-xs text-red-500 mt-1">{errors.confirmNewPassword.message}</p>
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
              <span>กำลังอัปเดต...</span>
            </>
          ) : (
            <span>อัปเดตรหัสผ่านใหม่</span>
          )}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-xs text-neutral-400">กำลังตรวจสอบลิงก์กู้คืน...</p>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
