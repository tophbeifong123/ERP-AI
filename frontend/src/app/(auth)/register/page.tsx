'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react';

import { registerSchema, RegisterInput } from '../../../core/validations/auth-schema';
import { authService } from '../../../core/services/auth-service';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true);
    try {
      // 1. เรียกใช้งาน API Register
      await authService.register({
        email: data.email,
        password: data.password,
      });
      
      toast.success('สมัครสมาชิกเสร็จสิ้น');
      setIsSuccess(true);
    } catch (error) {
      let errMsg = 'สมัครสมาชิกไม่สำเร็จ อีเมลนี้อาจถูกใช้งานไปแล้ว';
      if (axios.isAxiosError(error) && error.response?.data) {
        errMsg = (error.response.data as { message?: string })?.message || errMsg;
      }
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-6 text-center py-4 animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 mb-2">
          <Mail className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-white">ส่งอีเมลยืนยันสำเร็จ!</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
            ระบบส่งลิงก์ยืนยันตัวตนไปที่อีเมลของท่านเรียบร้อยแล้ว กรุณากดลิงก์ดังกล่าวเพื่อเปิดใช้งานบัญชี
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
        <h2 className="text-xl font-bold text-white">สร้างบัญชีร้านค้าใหม่</h2>
        <p className="text-xs text-neutral-400">
          เริ่มต้นความสะดวกสบายในการจัดการเพจด้วยระบบอัจฉริยะ AI
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
          <Label htmlFor="password" className="text-xs font-medium text-neutral-300">
            รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)
          </Label>
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

        {/* Confirm Password Field */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-xs font-medium text-neutral-300">
            ยืนยันรหัสผ่าน
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="••••••••"
              disabled={isLoading}
              className="h-10 pr-10 bg-neutral-900 border-neutral-800 text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              {...register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 focus:outline-none"
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>
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
              <span>กำลังสร้างบัญชี...</span>
            </>
          ) : (
            <span>สมัครสมาชิก</span>
          )}
        </Button>
      </form>

      {/* Footer Link */}
      <div className="text-center text-xs text-neutral-400 pt-2 border-t border-neutral-800/60">
        มีบัญชีอยู่แล้ว?{' '}
        <Link
          href="/login"
          className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
        >
          เข้าสู่ระบบที่นี่
        </Link>
      </div>
    </div>
  );
}
