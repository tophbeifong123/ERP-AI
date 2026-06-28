// src/app/(dashboard)/dashboard/page.tsx
'use client';

import React from 'react';
import { 
  Building, 
  TrendingUp, 
  ThumbsUp, 
  MessageSquare, 
  Plus, 
  ArrowUpRight 
} from 'lucide-react';
import { useBusinessStore } from '@/hooks/store/use-business-store';

export default function DashboardPage() {
  const { activeBusiness } = useBusinessStore();

  const stats = [
    { name: 'สถิติการโพสต์', value: '12 / เดือน', change: '+20%', icon: TrendingUp },
    { name: 'จำนวนการโต้ตอบ (Engagement)', value: '1.2K', change: '+12%', icon: ThumbsUp },
    { name: 'ความคิดเห็นที่รอดำเนินการ', value: '4 รายการ', change: 'ปกติ', icon: MessageSquare },
  ];

  return (
    <div className="space-y-6">
      {/* Header Block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white mb-1">ภาพรวมแดชบอร์ด</h1>
          <p className="text-xs text-muted-foreground">
            วิเคราะห์และจัดการโพสต์ล่าสุดสำหรับแบรนด์: <span className="text-indigo-400 font-bold">{activeBusiness?.name}</span>
          </p>
        </div>
        <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-xs font-bold text-white shadow shadow-primary/20 transition cursor-pointer">
          <Plus className="w-4 h-4" />
          สร้างโพสต์ด่วน (AI)
        </button>
      </div>

      {/* Grid Quick Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="glass-panel glow-indigo rounded-xl p-5 flex items-center justify-between">
              <div className="space-y-2">
                <span className="text-xxs font-bold text-muted-foreground uppercase tracking-wider block">{stat.name}</span>
                <span className="text-xl font-extrabold text-white block">{stat.value}</span>
                <span className="inline-flex items-center text-xxs text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  {stat.change}
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Workspace Layout Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Recent AI Posts */}
        <div className="lg:col-span-2 glass-panel rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-extrabold text-white">โพสต์ล่าสุดของ AI</h2>
            <button className="text-xxs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-0.5">
              ดูทั้งหมด <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="flex flex-col items-center justify-center p-10 text-center gap-3 border border-dashed border-white/5 rounded-lg bg-neutral-900/10">
            <Building className="w-8 h-8 text-muted-foreground" />
            <div>
              <span className="block text-xs font-semibold text-white">ยังไม่มีคิวโพสต์ที่อนุมัติ</span>
              <span className="block text-xxs text-muted-foreground max-w-xs mt-1 leading-normal">
                AI จะแนะนำ Content Plan โพสต์แรกสำหรับการตลาดของคุณในวันพรุ่งนี้ เวลา 06:00 น.
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Active Channel Connections */}
        <div className="glass-panel rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-extrabold text-white">ช่องทางสื่อที่ผูกสิทธิ์</h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-neutral-900/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-extrabold text-xs">
                  f
                </div>
                <div>
                  <span className="block text-xs font-bold text-white">Facebook Page</span>
                  <span className="block text-xxs text-muted-foreground">เชื่อมต่ออยู่</span>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 block" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-neutral-900/20 opacity-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 font-extrabold text-xs">
                  L
                </div>
                <div>
                  <span className="block text-xs font-bold text-white">LINE Official Account</span>
                  <span className="block text-xxs text-muted-foreground">ยังไม่เชื่อมต่อ</span>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-neutral-600 block" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
