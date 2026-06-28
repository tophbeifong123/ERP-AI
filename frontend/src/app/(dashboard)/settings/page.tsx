// src/app/(dashboard)/settings/page.tsx
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Briefcase,
  Clock,
  Trash2,
  AlertTriangle,
  Loader2,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';

import { useBusinessStore } from '@/hooks/store/use-business-store';
import { businessService, FacebookPageOption } from '@/core/services/business-service';
import { CreateBusinessInput, AutoPostConfigInput } from '@/core/validations/business-schema';

// นำเข้า Onboarding Reusable Components
import Step1BusinessForm from '@/components/features/onboarding/step1-business-form';
import Step2PostSettings from '@/components/features/onboarding/step2-post-settings';
import Step4FbConnection from '@/components/features/onboarding/step4-fb-connection';

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    activeBusinessId,
    activeBusiness,
    fetchBusinesses,
    setActiveBusinessId
  } = useBusinessStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'autopost' | 'facebook' | 'danger'>('profile');
  const [loading, setLoading] = useState(false);

  // สำหรับการลบธุรกิจ (Danger Zone)
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // สำหรับ Facebook Integration
  const [fbStatus, setFbStatus] = useState<'idle' | 'connected' | 'error'>('idle');
  const [fbPages, setFbPages] = useState<FacebookPageOption[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedFbPageId, setSelectedFbPageId] = useState<string | null>(null);

  // ดึงรายการเพจ Facebook เมื่อสลับมาที่แท็บ Facebook
  useEffect(() => {
    if (activeTab === 'facebook' && activeBusinessId) {
      const timer = setTimeout(() => {
        setLoadingPages(true);
        businessService.getFacebookPages(activeBusinessId)
          .then((pages) => {
            setFbPages(pages);
            setFbStatus('connected');
            if (pages.length > 0) {
              setSelectedFbPageId(pages[0].fbPageId);
            }
          })
          .catch(() => {
            // หากดึงไม่ได้และยังไม่ได้กลับมาจาก OAuth แสดงว่ายังไม่เชื่อมต่อสิทธิ์
            if (searchParams.get('fb') !== 'connected') {
              setFbStatus('idle');
            }
          })
          .finally(() => {
            setLoadingPages(false);
          });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, activeBusinessId, searchParams]);

  // จัดการเมื่อกลับมาจากหน้า OAuth callback ของ Facebook
  useEffect(() => {
    const fbParam = searchParams.get('fb');
    const msgParam = searchParams.get('msg');
    
    if (fbParam === 'connected') {
      const timer = setTimeout(() => {
        setActiveTab('facebook');
        setFbStatus('connected');
        toast.success('เชื่อมโยงบัญชี Facebook สำเร็จแล้ว! กำลังดึงรายการเพจของคุณ...');
        if (activeBusinessId) {
          setLoadingPages(true);
          businessService.getFacebookPages(activeBusinessId)
            .then((pages) => {
              setFbPages(pages);
              if (pages.length > 0) {
                setSelectedFbPageId(pages[0].fbPageId);
              }
            })
            .catch(() => toast.error('ไม่สามารถโหลดรายการ Facebook Page ได้'))
            .finally(() => setLoadingPages(false));
        }
      }, 0);
      return () => clearTimeout(timer);
    } else if (fbParam === 'error') {
      const timer = setTimeout(() => {
        setActiveTab('facebook');
        setFbStatus('error');
        toast.error(msgParam || 'เกิดข้อผิดพลาดในการเชื่อมต่อสิทธิ์ Facebook');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, activeBusinessId]);

  // หากไม่มีการเลือกธุรกิจ ทำการส่งกลับไปหน้าแดชบอร์ดหลัก
  useEffect(() => {
    if (!activeBusinessId && !activeBusiness) {
      toast.error('ไม่พบบริบทธุรกิจ กรุณาเลือกหรือเพิ่มธุรกิจแบรนด์ก่อน');
      router.push('/dashboard');
    }
  }, [activeBusinessId, activeBusiness, router]);

  // --- Submit 1: Update Profile ---
  const handleUpdateProfile = async (data: CreateBusinessInput, logoFile: File | null) => {
    if (!activeBusinessId) return;
    setLoading(true);
    try {
      await businessService.updateBusiness(activeBusinessId, data, logoFile || undefined);
      await fetchBusinesses();
      toast.success('อัปเดตข้อมูลทั่วไปของธุรกิจเรียบร้อยแล้ว');
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  // --- Submit 2: Update AutoPost Config ---
  const handleUpdateAutoPost = async (data: AutoPostConfigInput) => {
    if (!activeBusinessId) return;
    setLoading(true);
    try {
      await businessService.updateAutoPostConfig(activeBusinessId, data);
      await fetchBusinesses();
      toast.success('อัปเดตการตั้งค่าการโพสต์อัตโนมัติสำเร็จแล้ว');
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'ไม่สามารถบันทึกตารางการตั้งค่าได้');
    } finally {
      setLoading(false);
    }
  };

  // --- Submit 4: Connect Facebook Page & Save ---
  const handleConnectFacebookOAuth = async () => {
    if (!activeBusinessId) return;
    setLoading(true);
    try {
      // ยิงเช็กสิทธิ์เพื่อกระตุ้นให้ Axios Interceptor ต่ออายุ Token (หากหมดอายุแล้ว) ก่อนย้ายไปทำ OAuth
      const { authService } = await import('@/core/services/auth-service');
      await authService.getMe();
      const { useAuthStore } = await import('@/hooks/store/use-auth-store');
      const freshAccessToken = useAuthStore.getState().accessToken;

      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      window.location.href = `${backendUrl}/facebook/oauth/start?businessId=${activeBusinessId}&token=${freshAccessToken}`;
    } catch {
      toast.error('ไม่สามารถยืนยันความปลอดภัยเพื่อเริ่มเชื่อมต่อ Facebook ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeFacebook = async () => {
    if (!activeBusinessId || !selectedFbPageId) {
      toast.error('กรุณาเลือกเพจ Facebook ที่ต้องการเชื่อมต่อ');
      return;
    }

    setLoading(true);
    try {
      await businessService.connectFacebookPage(activeBusinessId, selectedFbPageId);
      await fetchBusinesses();
      toast.success('เชื่อมต่อเพจ Facebook เข้ากับธุรกิจแบรนด์ของคุณสำเร็จแล้ว!');
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'ไม่สามารถผูกบัญชีเพจเข้ากับระบบได้');
    } finally {
      setLoading(false);
    }
  };

  // --- Danger Zone: Delete Business ---
  const handleDeleteBusiness = async () => {
    if (!activeBusinessId || !activeBusiness) return;
    if (deleteConfirmName !== activeBusiness.name) {
      toast.error('กรุณาพิมพ์ชื่อธุรกิจให้ตรงเพื่อทำการยืนยันการลบ');
      return;
    }

    setIsDeleting(true);
    try {
      await businessService.deleteBusiness(activeBusinessId);
      toast.success('ลบแบรนด์ธุรกิจออกจากระบบเรียบร้อยแล้ว');
      
      const remainingBusinesses = await fetchBusinesses();
      
      if (remainingBusinesses.length > 0) {
        setActiveBusinessId(remainingBusinesses[0].id);
        localStorage.setItem('active_business_id', remainingBusinesses[0].id);
        router.push('/dashboard');
      } else {
        setActiveBusinessId('');
        localStorage.removeItem('active_business_id');
        router.push('/onboarding');
      }
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'เกิดข้อผิดพลาดในการลบข้อมูลธุรกิจ');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
          <Settings className="w-6 h-6 animate-spin-slow" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">ตั้งค่าข้อมูลระบบแบรนด์</h1>
          <p className="text-sm text-muted-foreground">ปรับปรุงข้อมูลแบรนด์ ตั้งค่าโหมดตารางเวลาทำงานของ AI และจัดการการเชื่อมต่อโซเชียลมีเดีย</p>
        </div>
      </div>

      {/* Tabs Menu Navigation */}
      <div className="flex border-b border-border gap-1 overflow-x-auto pb-px">
        {(
          [
            { key: 'profile', l: 'ข้อมูลทั่วไปธุรกิจ', icon: Briefcase },
            { key: 'autopost', l: 'ระบบโพสต์อัตโนมัติ', icon: Clock },
            { key: 'facebook', l: 'เชื่อมต่อ Facebook Page', icon: Settings },
            { key: 'danger', l: 'Danger Zone (ลบธุรกิจ)', icon: Trash2 },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.l}
            </button>
          );
        })}
      </div>

      {/* Tabs Contents Wrapper */}
      <div className="glass-panel glow-indigo rounded-2xl p-6 sm:p-8 shadow-xl">
        
        {/* Tab 1: Profile Form (Reuse Step1BusinessForm) */}
        {activeTab === 'profile' && activeBusiness && (
          <div className="space-y-4">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">แก้ไขรายละเอียดธุรกิจ</h2>
              <p className="text-xs text-muted-foreground">แก้ไขข้อมูลเพื่อป้อนคลังความรู้ให้ AI ใช้ประมวลผลวางแผนคอนเทนต์</p>
            </div>
            <Step1BusinessForm
              onSubmit={handleUpdateProfile}
              loading={loading}
              hideBack={true}
              defaultValues={{
                name: activeBusiness.name,
                industry: activeBusiness.industry,
                description: activeBusiness.description || '',
                targetAudience: activeBusiness.targetAudience || '',
                tone: activeBusiness.tone || 'friendly',
                keywords: activeBusiness.keywords || [],
              }}
              defaultLogoUrl={activeBusiness.logo?.publicUrl || null}
            />
          </div>
        )}

        {/* Tab 2: AutoPost Settings (Reuse Step2PostSettings) */}
        {activeTab === 'autopost' && activeBusiness && (
          <div className="space-y-4">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">กำหนดพฤติกรรมการตัดสินใจของ AI</h2>
              <p className="text-xs text-muted-foreground">สลับความถี่และตั้งตารางเวลาทำงานสำหรับการส่งโพสต์อัตโนมัติ</p>
            </div>
            <Step2PostSettings
              onSubmit={handleUpdateAutoPost}
              loading={loading}
              hideBack={true}
              defaultValues={{
                enabled: activeBusiness.autoPostEnabled,
                mode: activeBusiness.autoPostMode || 'ai_decide',
                postsPerWeekTarget: activeBusiness.postsPerWeekTarget,
                minGapDays: activeBusiness.minGapDays,
                fixedScheduleRules: activeBusiness.fixedScheduleRules || [],
              }}
            />
          </div>
        )}

        {/* Tab 3: Facebook Connection (Reuse Step4FbConnection) */}
        {activeTab === 'facebook' && (
          <div className="space-y-4">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">เชื่อมต่อและผูกสิทธิ์ Facebook Page</h2>
              <p className="text-xs text-muted-foreground">ผูกเพจโซเชียลมีเดียที่จะเป็นปลายทางในการนำส่งโพสต์อัตโนมัติ</p>
            </div>
            <Step4FbConnection
              fbStatus={fbStatus}
              fbPages={fbPages}
              loadingPages={loadingPages}
              selectedFbPageId={selectedFbPageId}
              setSelectedFbPageId={setSelectedFbPageId}
              onConnectOAuth={handleConnectFacebookOAuth}
              onFinalize={handleFinalizeFacebook}
              loading={loading}
              hideBack={true}
              finalizeText="บันทึกการผูกเพจ Facebook"
            />
          </div>
        )}

        {/* Tab 4: Danger Zone (Delete Business) */}
        {activeTab === 'danger' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 flex gap-4 animate-shake">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <span className="block text-sm font-bold text-destructive">คำเตือน: การลบแบรนด์ธุรกิจมีความเสี่ยงสูง!</span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  การกระทำนี้จะลบข้อมูลธุรกิจ แฟ้มประวัติสินค้า/บริการ ตารางการโพสต์ทั้งหมด รวมถึงสิทธิ์การผูกเชื่อมโยงเพจ Facebook Page ของธุรกิจนี้ออกอย่างถาวรโดยทันที และไม่สามารถเรียกกลับคืนมาได้อีก
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground block">
                  กรุณาพิมพ์ชื่อธุรกิจ <span className="font-extrabold text-destructive select-none">&quot;{activeBusiness?.name}&quot;</span> เพื่อยืนยันการลบแบรนด์ธุรกิจนี้
                </label>
                <input
                  type="text"
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder="พิมพ์ชื่อแบรนด์ร้านค้าตรงนี้..."
                  className="w-full px-3.5 py-2 rounded-lg border border-destructive/30 bg-background text-foreground focus:border-destructive focus:ring-1 focus:ring-destructive outline-none transition"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleDeleteBusiness}
                  disabled={isDeleting || deleteConfirmName !== activeBusiness?.name}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-destructive hover:bg-destructive/90 text-sm font-bold text-white shadow-lg disabled:opacity-50 cursor-pointer transition-all duration-200"
                >
                  {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Trash2 className="w-4 h-4" />
                  ลบธุรกิจข้อมูลอย่างถาวร
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px] bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
