// src/app/(dashboard)/layout.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Image as ImageIcon, 
  LogOut, 
  Menu, 
  ChevronDown, 
  User, 
  Building,
  Loader2,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '@/hooks/store/use-auth-store';
import { useBusinessStore } from '@/hooks/store/use-business-store';
import { authService } from '@/core/services/auth-service';

// โหลด shadcn/ui components
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from '@/components/ui/sheet';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, clearAuth, isAuthenticated } = useAuthStore();
  const { 
    businesses, 
    activeBusinessId, 
    activeBusiness,
    setActiveBusinessId, 
    fetchBusinesses 
  } = useBusinessStore();

  const [initializing, setInitializing] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ตรวจจับสิทธิ์การใช้งานของเพจ (Route Guarding & Auto Load Businesses)
  useEffect(() => {
    // 1. ตรวจสอบว่าเข้าสู่ระบบหรือยัง
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
    if (!refreshToken && !isAuthenticated) {
      router.push('/login');
      return;
    }

    // 2. ดึงรายการธุรกิจของผู้ใช้
    fetchBusinesses()
      .then((list) => {
        // หากไม่มีธุรกิจเลย ให้ส่งตัวไปหน้า onboarding เพื่อบังคับตั้งค่าก่อน
        if (list.length === 0) {
          toast.info('กรุณาตั้งค่าโปรไฟล์ธุรกิจเริ่มต้นก่อนเข้าใช้งานระบบ');
          router.push('/onboarding');
        } else {
          setInitializing(false);
        }
      })
      .catch(() => {
        toast.error('เซสชันของท่านหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
        clearAuth();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('refresh_token');
        }
        router.push('/login');
      });
  }, [isAuthenticated, fetchBusinesses, router, clearAuth]);

  // ฟังก์ชันออกจากระบบ (Logout)
  const handleLogout = async () => {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch {
      // เพิกเฉยต่อความล้มเหลวของ API ในการ logout เพื่อล้างหน้าบ้านได้เลย
    } finally {
      clearAuth();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('active_business_id');
      }
      toast.success('ออกจากระบบเรียบร้อยแล้ว');
      router.push('/login');
    }
  };

  // เมนูนำทาง
  const menuItems = [
    { name: 'แดชบอร์ดหลัก', href: '/dashboard', icon: LayoutDashboard },
    { name: 'ห้องทำงาน AI โพสต์', href: '/posts', icon: ImageIcon },
    { name: 'จัดการสินค้า/บริการ', href: '/services', icon: ShoppingBag },
  ];

  if (initializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">กำลังโหลดข้อมูลระบบ...</p>
      </div>
    );
  }

  // ส่วนแสดงผลเมนูภายในแถบ Sidebar
  const sidebarContent = (
    <div className="flex flex-col h-full justify-between">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="px-4 py-1.5 flex items-center gap-2">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white font-extrabold text-sm shadow shadow-indigo-500/20 select-none">
            EA
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            ERP<span className="text-indigo-400 font-extrabold">.AI</span>
          </span>
        </div>

        {/* Business Switcher Dropdown (ปุ่มสลับแบรนด์ธุรกิจ) */}
        <div className="px-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-neutral-900/40 border border-white/5 text-left text-xs font-semibold text-white hover:bg-neutral-900/80 transition cursor-pointer outline-none">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <Building className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{activeBusiness?.name || 'เลือกธุรกิจ'}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[220px] bg-neutral-950 border border-white/10 text-white">
              <div className="text-xxs text-muted-foreground font-bold px-2 py-1.5 select-none">
                เลือกธุรกิจที่จะใช้งาน
              </div>
              <DropdownMenuSeparator className="bg-white/5" />
              {businesses.map((biz) => (
                <DropdownMenuItem
                  key={biz.id}
                  onClick={() => {
                    setActiveBusinessId(biz.id);
                    toast.success(`สลับการใช้บริการไปยัง: ${biz.name}`);
                  }}
                  className="flex items-center justify-between text-xs px-2 py-2 hover:bg-white/5 rounded cursor-pointer transition outline-none"
                >
                  <span className="truncate pr-2">{biz.name}</span>
                  {activeBusinessId === biz.id && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem
                onClick={() => router.push('/onboarding?step=1')}
                className="flex items-center justify-center gap-1 text-xs text-indigo-400 font-semibold py-1.5 hover:bg-indigo-500/10 cursor-pointer"
              >
                + เพิ่มธุรกิจใหม่
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Navigation Link Lists */}
        <nav className="px-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isSelected = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                  isSelected 
                    ? 'bg-primary text-white shadow shadow-primary/20' 
                    : 'text-muted-foreground hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User settings & Logout */}
      <div className="p-3 border-t border-white/5 space-y-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left transition cursor-pointer outline-none">
            <div className="w-8 h-8 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center text-muted-foreground shrink-0 overflow-hidden">
              <User className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1 overflow-hidden">
              <span className="block text-xs font-semibold text-white truncate">{user?.email.split('@')[0]}</span>
              <span className="block text-xxs text-muted-foreground truncate">{user?.email}</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-[180px] bg-neutral-950 border border-white/10 text-white">
            <DropdownMenuItem 
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-400 px-3.5 py-2 cursor-pointer transition outline-none"
            >
              <LogOut className="w-4 h-4" />
              ออกจากระบบ
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Minimal Footer */}
        <span className="block text-[10px] text-center text-muted-foreground select-none">
          © 2026 ERP.AI. All rights reserved.
        </span>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen flex bg-background">
      {/* Decorative Glow (แสงเรืองแสงตกแต่งที่มุมจอแบบพรีเมียม) */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-indigo-600/3 blur-[140px] pointer-events-none z-0" />

      {/* Desktop Sidebar (แถบเมนูคงที่บนจอใหญ่) */}
      <aside className="w-64 border-r border-white/5 bg-neutral-900/10 backdrop-blur-xl h-screen sticky top-0 hidden md:block shrink-0 py-4 z-20">
        {sidebarContent}
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 z-10">
        
        {/* Mobile Navbar Header (แถบนำทางด้านบนเฉพาะจอมือถือ) */}
        <header className="h-16 border-b border-white/5 bg-background/60 backdrop-blur-md px-4 flex items-center justify-between md:hidden shrink-0">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white font-extrabold text-xs shadow shadow-indigo-500/20 select-none">
              EA
            </div>
            <span className="text-sm font-bold tracking-tight text-white">
              ERP<span className="text-indigo-400 font-extrabold">.AI</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Trigger (ปุ่มเปิด Drawer หน้าเมนู) */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-white transition cursor-pointer">
                <Menu className="w-5 h-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-4 bg-neutral-950 border-r border-white/10 text-white">
                {sidebarContent}
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Content Children Slot */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
