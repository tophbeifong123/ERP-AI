// src/components/features/onboarding/step2-post-settings.tsx
'use client';

import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { autoPostConfigSchema, AutoPostConfigInput } from '@/core/validations/business-schema';

interface Step2PostSettingsProps {
  onSubmit: (data: AutoPostConfigInput) => Promise<void>;
  loading: boolean;
  onBack: () => void;
}

export default function Step2PostSettings({ onSubmit, loading, onBack }: Step2PostSettingsProps) {
  const [newRuleDay, setNewRuleDay] = useState(1); // 1 = Monday
  const [newRuleTime, setNewRuleTime] = useState('09:00');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
  } = useForm<AutoPostConfigInput>({
    resolver: zodResolver(autoPostConfigSchema),
    defaultValues: {
      enabled: true,
      mode: 'ai_decide',
      postsPerWeekTarget: 3,
      minGapDays: 1,
      fixedScheduleRules: [],
    },
  });

  const autoPostEnabled = watch('enabled');
  const autoPostMode = watch('mode');

  const { fields: scheduleRules, append: appendRule, remove: removeRule } = useFieldArray({
    control,
    name: 'fixedScheduleRules',
  });

  const addScheduleRule = () => {
    const isDuplicate = scheduleRules.some(
      (r) => r.dayOfWeek === newRuleDay && r.time === newRuleTime
    );
    if (isDuplicate) {
      toast.error('กฎนี้มีอยู่แล้วในตารางการโพสต์');
      return;
    }
    appendRule({ dayOfWeek: newRuleDay, time: newRuleTime });
  };

  const getDayName = (day: number) => {
    const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    return `วัน${days[day]}`;
  };

  const handleFormSubmit = (data: AutoPostConfigInput) => {
    if (data.enabled && data.mode === 'fixed_schedule' && data.fixedScheduleRules.length === 0) {
      toast.error('กรุณาเพิ่มตารางเวลาอย่างน้อย 1 รายการสำหรับโหมดตั้งเวลาคงที่');
      return;
    }
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 flex-1 flex flex-col justify-between">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">ตั้งค่าความถี่และระบบโพสต์อัตโนมัติ</h2>
          <p className="text-sm text-muted-foreground">กำหนดพฤติกรรมการตัดสินใจของ AI และตารางเวลาก่อนโพสต์ไปยัง Facebook Page ของคุณ</p>
        </div>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-neutral-900/40">
          <div>
            <span className="block text-sm font-semibold text-white">เปิดใช้งานโพสต์อัตโนมัติ</span>
            <span className="block text-xs text-muted-foreground">ให้ AI คิดเนื้อหาและสลอตเวลาเพื่อร่างโพสต์รอให้คุณอนุมัติ</span>
          </div>
          <button
            type="button"
            onClick={() => setValue('enabled', !autoPostEnabled)}
            className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${
              autoPostEnabled ? 'bg-primary' : 'bg-neutral-800'
            }`}
          >
            <span 
              className={`block w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform duration-200 ${
                autoPostEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {autoPostEnabled && (
          <div className="space-y-6 animate-fade-in">
            {/* Mode Selector */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-white block">โหมดการโพสต์</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setValue('mode', 'ai_decide')}
                  className={`p-4 rounded-xl border text-left transition ${
                    autoPostMode === 'ai_decide'
                      ? 'border-primary bg-primary/5'
                      : 'border-white/5 bg-neutral-900/20 text-muted-foreground hover:bg-white/5'
                  }`}
                >
                  <span className="block text-sm font-bold text-white mb-1">AI Decide</span>
                  <span className="block text-xs text-muted-foreground leading-normal">AI ตัดสินใจช่วงเวลาและจำนวนโพสต์ที่เหมาะสมที่สุดในแต่ละสัปดาห์ให้โดยอัตโนมัติ</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setValue('mode', 'fixed_schedule')}
                  className={`p-4 rounded-xl border text-left transition ${
                    autoPostMode === 'fixed_schedule'
                      ? 'border-primary bg-primary/5'
                      : 'border-white/5 bg-neutral-900/20 text-muted-foreground hover:bg-white/5'
                  }`}
                >
                  <span className="block text-sm font-bold text-white mb-1">Fixed Schedule</span>
                  <span className="block text-xs text-muted-foreground leading-normal">โพสต์ตามเวลาที่กำหนดตายตัว เช่น ทุกวันจันทร์ วันพุธ และวันศุกร์ เวลา 18:00 น.</span>
                </button>
              </div>
            </div>

            {/* Mode: AI Decide Inputs */}
            {autoPostMode === 'ai_decide' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-white/5 bg-neutral-900/40">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white block">เป้าหมายจำนวนโพสต์ต่อสัปดาห์</label>
                  <input
                    type="number"
                    {...register('postsPerWeekTarget', { valueAsNumber: true })}
                    className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-neutral-900/40 text-white outline-none focus:border-primary"
                  />
                  <span className="block text-xxs text-muted-foreground">แนะนำเฉลี่ย 3-5 โพสต์</span>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white block">ระยะห่างขั้นต่ำต่อโพสต์ (วัน)</label>
                  <input
                    type="number"
                    {...register('minGapDays', { valueAsNumber: true })}
                    className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-neutral-900/40 text-white outline-none focus:border-primary"
                  />
                  <span className="block text-xxs text-muted-foreground">เพื่อป้องกันโพสต์ถี่เกินไป</span>
                </div>
              </div>
            )}

            {/* Mode: Fixed Schedule Rule Inputs */}
            {autoPostMode === 'fixed_schedule' && (
              <div className="space-y-4 p-4 rounded-xl border border-white/5 bg-neutral-900/40">
                <span className="block text-sm font-semibold text-white">ตารางเวลาส่งโพสต์อ้างอิง</span>
                
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xxs font-semibold text-muted-foreground block">วัน</label>
                    <select
                      value={newRuleDay}
                      onChange={(e) => setNewRuleDay(Number(e.target.value))}
                      className="w-full px-2 py-1.5 rounded-lg border border-white/5 bg-neutral-950 text-xs text-white outline-none"
                    >
                      <option value={1}>วันจันทร์</option>
                      <option value={2}>วันอังคาร</option>
                      <option value={3}>วันพุธ</option>
                      <option value={4}>วันพฤหัสบดี</option>
                      <option value={5}>วันศุกร์</option>
                      <option value={6}>วันเสาร์</option>
                      <option value={0}>วันอาทิตย์</option>
                    </select>
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <label className="text-xxs font-semibold text-muted-foreground block">เวลา</label>
                    <input
                      type="time"
                      value={newRuleTime}
                      onChange={(e) => setNewRuleTime(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-white/5 bg-neutral-950 text-xs text-white outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={addScheduleRule}
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    เพิ่มเวลา
                  </button>
                </div>

                {/* Display added rules */}
                <div className="space-y-2 pt-2">
                  {scheduleRules.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-2">ยังไม่มีตารางการโพสต์ที่ตั้งไว้</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {scheduleRules.map((rule, idx) => (
                        <span 
                          key={rule.id}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white"
                        >
                          {getDayName(rule.dayOfWeek)} {rule.time}
                          <button type="button" onClick={() => removeRule(idx)} className="text-muted-foreground hover:text-red-400">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-6 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-white/10 text-sm font-semibold text-white hover:bg-white/5 cursor-pointer transition"
        >
          ย้อนกลับ
        </button>
        
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-sm font-bold text-white shadow-lg disabled:opacity-50 cursor-pointer transition"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          ขั้นตอนถัดไป
        </button>
      </div>
    </form>
  );
}
