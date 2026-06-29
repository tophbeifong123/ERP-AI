// src/app/(dashboard)/settings/page.tsx
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Briefcase,
  Trash2,
  AlertTriangle,
  Loader2,
  Settings,
  Globe,
  Check,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';

import { useBusinessStore } from '@/hooks/store/use-business-store';
import { businessService, FacebookPageOption } from '@/core/services/business-service';
import { CreateBusinessInput } from '@/core/validations/business-schema';

// นำเข้า Onboarding Reusable Components
import Step1BusinessForm from '@/components/features/onboarding/step1-business-form';
import Step4FbConnection from '@/components/features/onboarding/step4-fb-connection';

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const LineIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.036 9.564.39.084.922.258 1.057.592.12.303.079.778.038 1.084-.131.968-.537 3.868-.537 3.868s-.167 1.002.696.58c.864-.422 4.658-2.732 6.357-4.18 1.353-.081 2.686-.39 3.896-.913 4.148-1.789 6.457-5.074 6.457-8.991zm-15.364.717h-1.579c-.276 0-.5.224-.5.5v3.197c0 .276.224.5.5.5h1.579c.276 0 .5-.224.5-.5v-.324c0-.276-.224-.5-.5-.5h-1.079v-.748h1.079c.276 0 .5-.224.5-.5v-.324c0-.276-.224-.5-.5-.5h-1.079v-.601h1.079c.276 0 .5-.224.5-.5v-.324c0-.276-.224-.5-.5-.5zm2.935 0h-.325c-.276 0-.5.224-.5.5v3.697c0 .276.224.5.5.5h.325c.276 0 .5-.224.5-.5v-3.697c0-.276-.224-.5-.5-.5zm4.07 0h-.326c-.276 0-.5.224-.5.5v2.247l-2.001-2.61c-.083-.111-.212-.178-.349-.178-.067 0-.135.016-.197.048-.184.093-.298.283-.298.49v3.697c0 .276.224.5.5.5h.325c.276 0 .5-.224.5-.5v-2.247l2.001 2.61c.083.111.212.178.349.178.067 0 .135-.016.197-.048.184-.093.298-.283.298-.49v-3.697c0-.276-.224-.5-.5-.5zm4.07 0h-1.579c-.276 0-.5.224-.5.5v3.197c0 .276.224.5.5.5h1.579c.276 0 .5-.224.5-.5v-.324c0-.276-.224-.5-.5-.5h-1.079v-.748h1.079c.276 0 .5-.224.5-.5v-.324c0-.276-.224-.5-.5-.5h-1.079v-.601h1.079c.276 0 .5-.224.5-.5v-.324c0-.276-.224-.5-.5-.5z" />
  </svg>
);

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    activeBusinessId,
    activeBusiness,
    fetchBusinesses,
    setActiveBusinessId
  } = useBusinessStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'facebook' | 'danger'>('profile');
  const [loading, setLoading] = useState(false);

  // สำหรับการลบธุรกิจ (Danger Zone)
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // สำหรับ Facebook Integration
  const [fbStatus, setFbStatus] = useState<'idle' | 'connected' | 'error'>('idle');
  const [fbPages, setFbPages] = useState<FacebookPageOption[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedFbPageId, setSelectedFbPageId] = useState<string | null>(null);

  // สำหรับ LINE & IG Connection Mock
  const [selectedChannel, setSelectedChannel] = useState<'facebook' | 'line' | 'instagram'>('facebook');
  const [isLineConnected, setIsLineConnected] = useState(false);
  const [isIgConnected, setIsIgConnected] = useState(false);
  const [lineLoading, setLineLoading] = useState(false);
  const [igLoading, setIgLoading] = useState(false);

  // Load mock LINE/IG connection state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsLineConnected(localStorage.getItem('is_line_connected') === 'true');
      setIsIgConnected(localStorage.getItem('is_ig_connected') === 'true');
    }
  }, []);

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

  // --- Facebook Page: Disconnect ---
  const handleDisconnectFacebook = async (pageId: string) => {
    if (!activeBusinessId) return;
    if (!confirm('คุณต้องการยกเลิกการเชื่อมต่อเพจ Facebook นี้ใช่หรือไม่?')) return;

    setLoading(true);
    try {
      await businessService.disconnectFacebookPage(activeBusinessId, pageId);
      await fetchBusinesses();
      setFbPages([]);
      setSelectedFbPageId('');
      setFbStatus('idle');
      toast.success('ยกเลิกการผูกเพจ Facebook ของคุณเรียบร้อยแล้ว');
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'ไม่สามารถยกเลิกการเชื่อมโยงเพจได้');
    } finally {
      setLoading(false);
    }
  };

  // --- LINE OA: Mock Connect/Disconnect ---
  const handleConnectLine = () => {
    setLineLoading(true);
    setTimeout(() => {
      setIsLineConnected(true);
      localStorage.setItem('is_line_connected', 'true');
      setLineLoading(false);
      toast.success('เชื่อมต่อ LINE Official Account สำเร็จ!');
    }, 1000);
  };

  const handleDisconnectLine = () => {
    if (!confirm('คุณต้องการยกเลิกการเชื่อมต่อ LINE Official Account นี้ใช่หรือไม่?')) return;
    setLineLoading(true);
    setTimeout(() => {
      setIsLineConnected(false);
      localStorage.setItem('is_line_connected', 'false');
      setLineLoading(false);
      toast.success('ยกเลิกการเชื่อมต่อ LINE Official Account เรียบร้อยแล้ว');
    }, 800);
  };

  // --- Instagram: Mock Connect/Disconnect ---
  const handleConnectIg = () => {
    setIgLoading(true);
    setTimeout(() => {
      setIsIgConnected(true);
      localStorage.setItem('is_ig_connected', 'true');
      setIgLoading(false);
      toast.success('เชื่อมต่อ Instagram Business สำเร็จ!');
    }, 1000);
  };

  const handleDisconnectIg = () => {
    if (!confirm('คุณต้องการยกเลิกการเชื่อมต่อ Instagram Business นี้ใช่หรือไม่?')) return;
    setIgLoading(true);
    setTimeout(() => {
      setIsIgConnected(false);
      localStorage.setItem('is_ig_connected', 'false');
      setIgLoading(false);
      toast.success('ยกเลิกการเชื่อมต่อ Instagram Business เรียบร้อยแล้ว');
    }, 800);
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

  // ดึงเพจที่ผูกกับธุรกิจปัจจุบัน (ถ้ามี)
  const activePage = activeBusiness?.facebookPages && activeBusiness.facebookPages.length > 0
    ? activeBusiness.facebookPages[0]
    : null;

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
            { key: 'facebook', l: 'เชื่อมต่อโซเชียลมีเดีย', icon: Globe },
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

        {/* Tab 3: Social Media Channels (Facebook, LINE, IG) */}
        {activeTab === 'facebook' && activeBusiness && (
          <div className="space-y-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">เชื่อมต่อและจัดการช่องทางเผยแพร่</h2>
              <p className="text-xs text-muted-foreground">ผูกบัญชีโซเชียลมีเดียต่างๆ ของธุรกิจเพื่อวางกำหนดการส่งโพสต์โปรโมชั่นอัตโนมัติด้วย AI</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Facebook Card */}
              <div 
                onClick={() => setSelectedChannel('facebook')}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                  selectedChannel === 'facebook'
                    ? 'border-primary bg-primary/5 glow-indigo shadow-sm'
                    : 'border-border bg-background hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1877F2]/10 text-[#1877F2] flex items-center justify-center shrink-0">
                    <FacebookIcon className="w-5 h-5 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-foreground truncate">Facebook Page</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
                      activePage ? 'text-emerald-500 bg-emerald-500/10' : 'text-muted-foreground bg-muted'
                    }`}>
                      {activePage ? 'เชื่อมต่อแล้ว' : 'ยังไม่ได้เชื่อมต่อ'}
                    </span>
                  </div>
                </div>
              </div>

              {/* LINE OA Card */}
              <div 
                onClick={() => setSelectedChannel('line')}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                  selectedChannel === 'line'
                    ? 'border-primary bg-primary/5 glow-indigo shadow-sm'
                    : 'border-border bg-background hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#06C755]/10 text-[#06C755] flex items-center justify-center shrink-0">
                    <LineIcon className="w-5 h-5 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-foreground truncate">LINE Official</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
                      isLineConnected ? 'text-emerald-500 bg-emerald-500/10' : 'text-muted-foreground bg-muted'
                    }`}>
                      {isLineConnected ? 'เชื่อมต่อแล้ว' : 'ยังไม่ได้เชื่อมต่อ'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Instagram Card */}
              <div 
                onClick={() => setSelectedChannel('instagram')}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                  selectedChannel === 'instagram'
                    ? 'border-primary bg-primary/5 glow-indigo shadow-sm'
                    : 'border-border bg-background hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center shrink-0">
                    <InstagramIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-foreground truncate">Instagram Feed</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
                      isIgConnected ? 'text-emerald-500 bg-emerald-500/10' : 'text-muted-foreground bg-muted'
                    }`}>
                      {isIgConnected ? 'เชื่อมต่อแล้ว' : 'ยังไม่ได้เชื่อมต่อ'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* selectedChannel: Facebook */}
            {selectedChannel === 'facebook' && (
              <div className="space-y-4 pt-4 border-t border-border/40 animate-fade-in">
                <div className="mb-2">
                  <h3 className="text-sm font-bold text-foreground">การเชื่อมโยงระบบ Facebook Page</h3>
                  <p className="text-xs text-muted-foreground">ผูกสิทธิ์บัญชีเพจเพื่อใช้นำส่งโพสต์โปรโมชั่นอัตโนมัติ</p>
                </div>
                {activePage ? (
                  <div className="p-6 rounded-xl border border-border bg-muted/20 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border border-border bg-background gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full border border-border bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                          {activePage.pictureUrl ? (
                            <img src={activePage.pictureUrl} alt={activePage.pageName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-primary font-bold text-lg">{activePage.pageName[0]}</span>
                          )}
                        </div>
                        <div>
                          <span className="block text-sm font-bold text-foreground">{activePage.pageName}</span>
                          <span className="inline-flex items-center gap-1 mt-1 text-xxs text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block animate-pulse" />
                            เชื่อมต่ออยู่กับระบบ AI
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDisconnectFacebook(activePage.id)}
                        disabled={loading}
                        className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-md disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                      >
                        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        ยกเลิกการเชื่อมต่อเพจ
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground leading-normal">
                      * การยกเลิกเชื่อมต่อจะทำให้ AI หยุดส่งโพสต์อัตโนมัติไปยังเพจนี้ชั่วคราว คุณสามารถทำการเชื่อมต่อใหม่ หรือเปลี่ยนสิทธิ์เป็นเพจอื่นได้ทุกเมื่อ
                    </p>
                  </div>
                ) : (
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
                )}
              </div>
            )}

            {/* selectedChannel: LINE OA */}
            {selectedChannel === 'line' && (
              <div className="space-y-4 pt-4 border-t border-border/40 animate-fade-in">
                <div className="mb-2">
                  <h3 className="text-sm font-bold text-foreground">การเชื่อมโยงระบบ LINE Official Account</h3>
                  <p className="text-xs text-muted-foreground">ผูกบัญชี LINE OA เพื่อให้ AI จัดการบรอดแคสต์และคุยกับลูกค้าผ่านไลน์แบรนด์</p>
                </div>
                {isLineConnected ? (
                  <div className="p-6 rounded-xl border border-border bg-muted/20 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border border-border bg-background gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full border border-border bg-[#06C755]/10 overflow-hidden shrink-0 flex items-center justify-center text-[#06C755]">
                          <LineIcon className="w-7 h-7 fill-current" />
                        </div>
                        <div>
                          <span className="block text-sm font-bold text-foreground">{activeBusiness.name} Official</span>
                          <span className="inline-flex items-center gap-1 mt-1 text-xxs text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block animate-pulse" />
                            เชื่อมต่ออยู่กับระบบ AI (จำลองสถานะแชนเนลจริง)
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDisconnectLine}
                        disabled={lineLoading}
                        className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-md disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                      >
                        {lineLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        ยกเลิกการเชื่อมต่อ LINE
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground leading-normal">
                      * การยกเลิกเชื่อมต่อจะปิดบริการแชทและบรอดแคสต์อัตโนมัติชั่วคราว คุณสามารถต่อสิทธิ์ใหม่ได้ทันที
                    </p>
                  </div>
                ) : (
                  <div className="p-6 border border-border bg-background rounded-xl space-y-4 max-w-xl">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-foreground block mb-1">LINE Provider ID</label>
                        <input
                          type="text"
                          placeholder="เช่น 1658402..."
                          defaultValue="165983719"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary transition"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-foreground block mb-1">LINE Channel ID</label>
                        <input
                          type="text"
                          placeholder="เช่น 200084..."
                          defaultValue="2004928172"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary transition"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-foreground block mb-1">LINE Channel Secret</label>
                        <input
                          type="password"
                          defaultValue="••••••••••••••••••••••••••••••••"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary transition"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleConnectLine}
                      disabled={lineLoading}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#06C755] hover:bg-[#06C755]/90 text-xs font-bold text-white shadow-md cursor-pointer transition disabled:opacity-50"
                    >
                      {lineLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LineIcon className="w-4 h-4 fill-current" />}
                      ยืนยันเชื่อมต่อ LINE OA
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* selectedChannel: Instagram */}
            {selectedChannel === 'instagram' && (
              <div className="space-y-4 pt-4 border-t border-border/40 animate-fade-in">
                <div className="mb-2">
                  <h3 className="text-sm font-bold text-foreground">การเชื่อมโยงระบบ Instagram Business</h3>
                  <p className="text-xs text-muted-foreground">เชื่อมต่อกับบัญชีธุรกิจไอจีเพื่อใช้อัปเดตรูปภาพ วิดีโอสั้น หรือสตอรี่โดย AI</p>
                </div>
                {isIgConnected ? (
                  <div className="p-6 rounded-xl border border-border bg-muted/20 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border border-border bg-background gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full border border-border bg-pink-500/10 overflow-hidden shrink-0 flex items-center justify-center text-pink-500">
                          <InstagramIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="block text-sm font-bold text-foreground">@{activeBusiness.name.toLowerCase()}_store</span>
                          <span className="inline-flex items-center gap-1 mt-1 text-xxs text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block animate-pulse" />
                            เชื่อมต่ออยู่กับระบบ AI (จำลองสถานะแชนเนลจริง)
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDisconnectIg}
                        disabled={igLoading}
                        className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-md disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                      >
                        {igLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        ยกเลิกการเชื่อมต่อ Instagram
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground leading-normal">
                      * การยกเลิกการเชื่อมโยงจะตัดขาดการแชร์รูปภาพ/โพสต์จากระบบไปยัง Instagram ของคุณโดยตรง
                    </p>
                  </div>
                ) : (
                  <div className="p-6 border border-border bg-background rounded-xl text-center space-y-4 max-w-md">
                    <div className="w-12 h-12 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center mx-auto shadow-inner">
                      <InstagramIcon className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <span className="block text-xs font-bold text-foreground">ผูกสิทธิ์บัญชี Instagram Business</span>
                      <p className="text-xxs text-muted-foreground leading-relaxed">
                        ระบบต้องเชื่อมต่อผ่านสิทธิ์ของ Facebook Suite (Instagram Graph API) เพื่อดึงข้อมูลเชิงลึกและส่งโพสต์ภาพ/คลิปสั้นไปยังหน้าฟีดธุรกิจของคุณ
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleConnectIg}
                      disabled={igLoading}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F56040] hover:opacity-90 text-xs font-bold text-white shadow-md cursor-pointer transition disabled:opacity-50"
                    >
                      {igLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <InstagramIcon className="w-4 h-4" />}
                      ล็อกอินเชื่อมโยง Instagram Account
                    </button>
                  </div>
                )}
              </div>
            )}
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
