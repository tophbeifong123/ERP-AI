'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';

import { forgotPasswordSchema, ForgotPasswordInput } from '../../../core/validations/auth-schema';
import { authService } from '../../../core/services/auth-service';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setIsLoading(true);
    try {
      // 1. เรียก API ส่งลิงก์กู้คืนรหัสผ่าน
      await authService.forgotPassword(data);
      
      // จากหลักการความปลอดภัย หลังบ้านตอบรับ 202 เสมอเพื่อป้องกัน User enumeration
      toast.success('ส่งคำขอกู้คืนรหัสผ่านแล้ว');
      setIsSuccess(true);
    } catch {
      toast.error('เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-6 text-center py-4 animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-400 mb-2">
          <MailCheck className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-white">ส่งคำขอกู้คืนรหัสผ่านสำเร็จ</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
            เราส่งคำชี้แจงในการตั้งรหัสผ่านใหม่ไปที่อีเมลของท่านเรียบร้อยแล้ว (หากไม่พบ กรุณาตรวจสอบในกล่องจดหมายขยะหรือ Spam)
          </p>
        </div>
        <div className="pt-2">
          <Link href="/login" className="inline-block w-full">
            <Button className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]">
              กลับไปหน้าเข้าสู่ระบบ
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-bold text-white">ลืมรหัสผ่าน</h2>
        <p className="text-xs text-neutral-400">
          กรอกอีเมลร้านค้าของท่านเพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่
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

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>กำลังส่งลิงก์...</span>
            </>
          ) : (
            <span>ส่งลิงก์กู้คืนรหัสผ่าน</span>
          )}
        </Button>
      </form>

      {/* Footer Link */}
      <div className="text-center text-xs text-neutral-400 pt-2 border-t border-neutral-800/60">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          <span>ย้อนกลับไปเข้าสู่ระบบ</span>
        </Link>
      </div>
    </div>
  );
}
