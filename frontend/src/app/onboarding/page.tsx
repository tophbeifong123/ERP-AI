// src/app/onboarding/page.tsx
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Briefcase, 
  Clock, 
  ShoppingBag, 
  Loader2, 
  Plus, 
  X, 
  Upload, 
  Check, 
  Trash2, 
  AlertCircle 
} from 'lucide-react';
import { toast } from 'sonner';

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

import { useAuthStore } from '@/hooks/store/use-auth-store';
import { useBusinessStore } from '@/hooks/store/use-business-store';
import { businessService, FacebookPageOption } from '@/core/services/business-service';
import { serviceService } from '@/core/services/service-service';
import { Service } from '@/core/types/service';
import { Tone } from '@/core/types/business';
import { 
  createBusinessSchema, 
  autoPostConfigSchema, 
  CreateBusinessInput, 
  AutoPostConfigInput 
} from '@/core/validations/business-schema';
import { serviceSchema, ServiceInput } from '@/core/validations/service-schema';

function OnboardingWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const step = Number(searchParams.get('step')) || 1;
  const urlBusinessId = searchParams.get('businessId');
  const fbStatus = searchParams.get('fb');
  const fbMsg = searchParams.get('msg');

  const { accessToken } = useAuthStore();
  const { 
    activeBusinessId, 
    setActiveBusinessId, 
    fetchActiveBusiness 
  } = useBusinessStore();

  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);

  // สำหรับเก็บสถานะโหลดรายการเพจและตัวเลือกเพจที่ได้รับจาก Facebook
  const [fbPages, setFbPages] = useState<FacebookPageOption[]>([]);
  const [selectedFbPageId, setSelectedFbPageId] = useState<string>('');
  const [loadingPages, setLoadingPages] = useState(false);

  // Sync businessId จาก URL (ถ้าข้ามกลับมาจาก Facebook OAuth)
  useEffect(() => {
    if (urlBusinessId && urlBusinessId !== activeBusinessId) {
      setActiveBusinessId(urlBusinessId);
      fetchActiveBusiness(urlBusinessId).catch(() => {
        toast.error('ไม่พบข้อมูลธุรกิจของท่าน');
      });
    }
  }, [urlBusinessId, activeBusinessId, setActiveBusinessId, fetchActiveBusiness]);

  // โหลดรายการสินค้า/บริการ เมื่ออยู่ step 3
  useEffect(() => {
    if (step === 3 && activeBusinessId) {
      setLoading(true);
      serviceService.getServices(activeBusinessId)
        .then(setServices)
        .catch(() => toast.error('ไม่สามารถโหลดข้อมูลสินค้าได้'))
        .finally(() => setLoading(false));
    }
  }, [step, activeBusinessId]);

  // โหลดรายการเพจ เมื่ออยู่ step 4 และเชื่อมต่อสำเร็จ
  useEffect(() => {
    if (step === 4 && activeBusinessId && fbStatus === 'connected') {
      setLoadingPages(true);
      businessService.getFacebookPages(activeBusinessId)
        .then((res) => {
          setFbPages(res);
          if (res.length > 0) {
            setSelectedFbPageId(res[0].fbPageId);
          }
        })
        .catch(() => toast.error('ไม่สามารถโหลดรายการ Facebook Page ได้'))
        .finally(() => setLoadingPages(false));
    }
  }, [step, activeBusinessId, fbStatus]);

  // แจ้งเตือนข้อผิดพลาด OAuth
  useEffect(() => {
    if (fbStatus === 'error') {
      toast.error(fbMsg || 'การเชื่อมต่อสิทธิ์ Facebook ล้มเหลว');
    }
  }, [fbStatus, fbMsg]);

  // ฟังก์ชันย้ายสเต็ป
  const setStep = (nextStep: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('step', nextStep.toString());
    router.push(`/onboarding?${params.toString()}`);
  };

  // --- Step 1: Create Business Profile ---
  const {
    register: registerBusiness,
    handleSubmit: handleSubmitBusiness,
    setValue: setBusinessValue,
    watch: watchBusiness,
    formState: { errors: businessErrors },
  } = useForm<CreateBusinessInput>({
    resolver: zodResolver(createBusinessSchema),
    defaultValues: {
      name: '',
      industry: '',
      description: '',
      targetAudience: '',
      tone: 'friendly',
      keywords: [],
    },
  });

  const keywords = watchBusiness('keywords') || [];
  const selectedTone = watchBusiness('tone');
  const [keywordInput, setKeywordInput] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const addKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && keywordInput.trim()) {
      e.preventDefault();
      if (!keywords.includes(keywordInput.trim())) {
        setBusinessValue('keywords', [...keywords, keywordInput.trim()], { shouldValidate: true });
      }
      setKeywordInput('');
    }
  };

  const removeKeyword = (kwToRemove: string) => {
    setBusinessValue(
      'keywords',
      keywords.filter((k) => k !== kwToRemove),
      { shouldValidate: true }
    );
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('ขนาดโลโก้ห้ามเกิน 5MB');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const onSubmitStep1 = async (data: CreateBusinessInput) => {
    setLoading(true);
    try {
      const business = await businessService.createBusiness(data, logoFile || undefined);
      setActiveBusinessId(business.id);
      toast.success('บันทึกข้อมูลธุรกิจเรียบร้อยแล้ว');
      setStep(2);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'เกิดข้อผิดพลาดในการสร้างธุรกิจ');
    } finally {
      setLoading(false);
    }
  };

  // --- Step 2: Auto-Post Settings ---
  const {
    register: registerSchedule,
    handleSubmit: handleSubmitSchedule,
    setValue: setScheduleValue,
    watch: watchSchedule,
    control: controlSchedule,
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

  const autoPostEnabled = watchSchedule('enabled');
  const autoPostMode = watchSchedule('mode');
  const { fields: scheduleRules, append: appendRule, remove: removeRule } = useFieldArray({
    control: controlSchedule,
    name: 'fixedScheduleRules',
  });

  const [newRuleDay, setNewRuleDay] = useState(1); // 1 = Monday
  const [newRuleTime, setNewRuleTime] = useState('09:00');

  const addScheduleRule = () => {
    // เช็คไม่ให้ซ้ำกัน
    const isDuplicate = scheduleRules.some(
      (r) => r.dayOfWeek === newRuleDay && r.time === newRuleTime
    );
    if (isDuplicate) {
      toast.error('กฎนี้มีอยู่แล้วในตารางการโพสต์');
      return;
    }
    appendRule({ dayOfWeek: newRuleDay, time: newRuleTime });
  };

  const onSubmitStep2 = async (data: AutoPostConfigInput) => {
    if (!activeBusinessId) {
      toast.error('ไม่พบข้อมูลธุรกิจ กรุณากลับไปขั้นตอนแรก');
      setStep(1);
      return;
    }

    if (data.enabled && data.mode === 'fixed_schedule' && data.fixedScheduleRules.length === 0) {
      toast.error('กรุณาเพิ่มตารางเวลาอย่างน้อย 1 รายการสำหรับโหมดตั้งเวลาคงที่');
      return;
    }

    setLoading(true);
    try {
      await businessService.updateAutoPostConfig(activeBusinessId, data);
      toast.success('บันทึกการตั้งค่าตารางโพสต์เรียบร้อย');
      setStep(3);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า');
    } finally {
      setLoading(false);
    }
  };

  // --- Step 3: Service Catalogue ---
  const {
    register: registerService,
    handleSubmit: handleSubmitService,
    reset: resetServiceForm,
    formState: { errors: serviceErrors },
  } = useForm<ServiceInput>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      description: '',
      price: '',
    },
  });

  const [serviceImageFile, setServiceImageFile] = useState<File | null>(null);
  const [serviceImagePreview, setServiceImagePreview] = useState<string | null>(null);

  const handleServiceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('ขนาดภาพถ่ายห้ามเกิน 5MB');
        return;
      }
      setServiceImageFile(file);
      setServiceImagePreview(URL.createObjectURL(file));
    }
  };

  const onSubmitService = async (data: ServiceInput) => {
    if (!activeBusinessId) return;
    setLoading(true);
    try {
      const newService = await serviceService.createService(
        activeBusinessId,
        data,
        serviceImageFile || undefined
      );
      setServices([...services, newService]);
      toast.success('เพิ่มสินค้าสำเร็จแล้ว');
      setShowAddServiceModal(false);
      resetServiceForm();
      setServiceImageFile(null);
      setServiceImagePreview(null);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'ไม่สามารถบันทึกสินค้าได้');
    } finally {
      setLoading(false);
    }
  };

  const deleteService = async (id: string) => {
    if (!confirm('คุณต้องการลบสินค้านี้ออกใช่หรือไม่?')) return;
    try {
      await serviceService.deleteService(id);
      setServices(services.filter((s) => s.id !== id));
      toast.success('ลบสินค้าออกแล้ว');
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'ไม่สามารถลบสินค้าได้');
    }
  };

  const onNextStep3 = () => {
    if (services.length === 0) {
      toast.error('กรุณาบันทึกสินค้า/บริการอย่างน้อย 1 รายการในแค็ตตาล็อก');
      return;
    }
    setStep(4);
  };

  // --- Step 4: Facebook Page Connection ---
  const handleConnectFacebookOAuth = () => {
    if (!activeBusinessId) return;
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    window.location.href = `${backendUrl}/facebook/oauth/start?businessId=${activeBusinessId}&token=${accessToken}`;
  };

  const handleFinalizeOnboarding = async () => {
    if (!activeBusinessId || !selectedFbPageId) {
      toast.error('กรุณาเลือกเพจ Facebook ที่ต้องการเชื่อมต่อ');
      return;
    }

    setLoading(true);
    try {
      await businessService.connectFacebookPage(activeBusinessId, selectedFbPageId);
      toast.success('ตั้งค่าแบรนด์เสร็จสิ้นแล้ว! ยินดีต้อนรับเข้าสู่ ERP-AI');
      router.push('/dashboard');
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'ไม่สามารถผูกบัญชีเพจเข้ากับระบบได้');
    } finally {
      setLoading(false);
    }
  };

  // ดึงวันจากตัวเลข (0-6)
  const getDayName = (day: number) => {
    const days = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    return days[day];
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col py-8 px-4 sm:px-6 lg:px-8">
      {/* Step Tracker (แถบแสดงความคืบหน้าแบบมินิมอลโปร่งใส) */}
      <div className="max-w-4xl w-full mx-auto mb-10">
        <div className="flex items-center justify-between relative px-2">
          {/* Progress background line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/5 -translate-y-1/2 z-0" />
          
          {/* Active progress fill line */}
          <div 
            className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 z-0 transition-all duration-500" 
            style={{ width: `${((step - 1) / 3) * 100}%` }}
          />

          {[
            { s: 1, label: 'ข้อมูลธุรกิจ', icon: Briefcase },
            { s: 2, label: 'ตั้งค่าการโพสต์', icon: Clock },
            { s: 3, label: 'คลังสินค้า', icon: ShoppingBag },
            { s: 4, label: 'เชื่อมต่อเพจ', icon: FacebookIcon },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = step >= item.s;
            const isCurrent = step === item.s;
            return (
              <div key={item.s} className="flex flex-col items-center z-10 relative">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCurrent 
                      ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/30 ring-4 ring-primary/20' 
                      : isActive 
                        ? 'bg-primary/80 text-white' 
                        : 'bg-neutral-900 border border-white/10 text-muted-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-xs mt-2 font-medium hidden sm:block ${
                  isCurrent ? 'text-primary' : isActive ? 'text-white' : 'text-muted-foreground'
                }`}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Container Card */}
      <div className="max-w-2xl w-full mx-auto glass-panel glow-indigo rounded-2xl p-6 sm:p-8 shadow-2xl flex-1 flex flex-col justify-between">
        
        {/* Step 1: Business Profile Form */}
        {step === 1 && (
          <form onSubmit={handleSubmitBusiness(onSubmitStep1)} className="space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">ข้อมูลหลักแบรนด์ธุรกิจ</h2>
                <p className="text-sm text-muted-foreground">บันทึกข้อมูลเพื่อเป็นแนวทางให้ AI เข้าใจแบรนด์ของคุณและวางแผนนำเสนอโพสต์</p>
              </div>

              {/* Logo Upload */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-white/5 bg-neutral-900/40">
                <div className="relative w-20 h-20 rounded-xl border border-white/10 bg-neutral-950 flex items-center justify-center overflow-hidden shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Briefcase className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 w-full text-center sm:text-left">
                  <span className="block text-sm font-medium text-white mb-1">อัปโหลดโลโก้ร้านค้า</span>
                  <p className="text-xs text-muted-foreground mb-2">รองรับรูปภาพ JPG, PNG (ขนาดไม่เกิน 5MB)</p>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white cursor-pointer transition">
                    <Upload className="w-3.5 h-3.5" />
                    เลือกรูปภาพ
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Brand Name */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white block">ชื่อธุรกิจ / ร้านค้า <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    {...registerBusiness('name')}
                    placeholder="เช่น ข้าวแกงเดลิเวอรี่เฮ้าส์"
                    className="w-full px-3.5 py-2 rounded-lg border border-white/5 bg-neutral-900/40 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                  />
                  {businessErrors.name && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" /> {businessErrors.name.message}
                    </p>
                  )}
                </div>

                {/* Industry */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white block">ประเภทหมวดหมู่อุตสาหกรรม <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    {...registerBusiness('industry')}
                    placeholder="เช่น อาหารและเครื่องดื่ม, ท่องเที่ยว, เสื้อผ้า"
                    className="w-full px-3.5 py-2 rounded-lg border border-white/5 bg-neutral-900/40 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                  />
                  {businessErrors.industry && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" /> {businessErrors.industry.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white block">จุดเด่นหรือลักษณะธุรกิจโดยสังเขป</label>
                <textarea
                  rows={3}
                  {...registerBusiness('description')}
                  placeholder="ช่วยเขียนอธิบายจุดขายหลัก หรือแนวคิดบริการของแบรนด์คุณ เพื่อนำไปประมวลผล..."
                  className="w-full px-3.5 py-2 rounded-lg border border-white/5 bg-neutral-900/40 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition resize-none"
                />
              </div>

              {/* Target Audience */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white block">กลุ่มเป้าหมายหลัก</label>
                <input
                  type="text"
                  {...registerBusiness('targetAudience')}
                  placeholder="เช่น วัยทำงานช่วงอายุ 25-45 ปี ที่ชื่นชอบความสะดวกและอาหารรสจัด"
                  className="w-full px-3.5 py-2 rounded-lg border border-white/5 bg-neutral-900/40 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                />
              </div>

              {/* Brand Tone */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white block">น้ำเสียงและสไตล์ของโพสต์ที่ต้องการ <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { key: 'friendly', l: 'เป็นกันเอง' },
                    { key: 'professional', l: 'น่าเชื่อถือ' },
                    { key: 'playful', l: 'สนุกสนาน' },
                    { key: 'luxurious', l: 'หรูหรา' },
                    { key: 'minimal', l: 'เรียบง่าย' },
                  ].map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setBusinessValue('tone', t.key as Tone, { shouldValidate: true })}
                      className={`py-2 px-1 rounded-lg border text-xs font-semibold transition ${
                        selectedTone === t.key
                          ? 'border-primary bg-primary/10 text-white shadow-md'
                          : 'border-white/5 bg-neutral-900/20 text-muted-foreground hover:bg-white/5'
                      }`}
                    >
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Keywords (Tag Input) */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white block">คีย์เวิร์ดสำคัญสำหรับการขาย (สะกดคำค้นหา) <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2 p-2 rounded-lg border border-white/5 bg-neutral-900/40 min-h-[42px] items-center">
                  {keywords.map((kw) => (
                    <span key={kw} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-indigo-500/20 border border-indigo-500/30 text-white">
                      {kw}
                      <button type="button" onClick={() => removeKeyword(kw)} className="hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={addKeyword}
                    placeholder={keywords.length === 0 ? "พิมพ์คีย์เวิร์ดแล้วกด Enter" : ""}
                    className="border-none bg-transparent outline-none text-xs text-white p-0.5 flex-1 min-w-[120px]"
                  />
                </div>
                <p className="text-xxs text-muted-foreground">เช่น &quot;แกงใต้แท้&quot;, &quot;ส่งฟรี&quot;, &quot;สูตรลับคุณยาย&quot; (กรอกอย่างน้อย 1 คำ)</p>
                {businessErrors.keywords && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" /> {businessErrors.keywords.message}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-sm font-bold text-white shadow-lg disabled:opacity-50 cursor-pointer transition"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                ขั้นตอนถัดไป
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Auto-Post Settings */}
        {step === 2 && (
          <form onSubmit={handleSubmitSchedule(onSubmitStep2)} className="space-y-6 flex-1 flex flex-col justify-between">
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
                  onClick={() => setScheduleValue('enabled', !autoPostEnabled)}
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
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setScheduleValue('mode', 'ai_decide')}
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
                        onClick={() => setScheduleValue('mode', 'fixed_schedule')}
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
                          {...registerSchedule('postsPerWeekTarget', { valueAsNumber: true })}
                          className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-neutral-900/40 text-white outline-none focus:border-primary"
                        />
                        <span className="block text-xxs text-muted-foreground">แนะนำเฉลี่ย 3-5 โพสต์</span>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-white block">ระยะห่างขั้นต่ำต่อโพสต์ (วัน)</label>
                        <input
                          type="number"
                          {...registerSchedule('minGapDays', { valueAsNumber: true })}
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
                            className="w-full px-2 py-1 rounded-lg border border-white/5 bg-neutral-950 text-xs text-white outline-none"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={addScheduleRule}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white flex items-center gap-1 transition"
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
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm font-semibold text-white hover:bg-white/5 cursor-pointer transition"
              >
                ย้อนกลับ
              </button>
              
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-sm font-bold text-white shadow-lg disabled:opacity-50 cursor-pointer transition"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                ขั้นตอนถัดไป
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Product / Service Catalog */}
        {step === 3 && (
          <div className="space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">คลังความรู้บริการและสินค้า</h2>
                  <p className="text-sm text-muted-foreground">ป้อนข้อมูลสินค้าเพื่อป้อนคลังความรู้สำหรับ AI ในการหยิบเขียนโปรโมทสะกดใจลูกค้า</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddServiceModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white flex items-center gap-1 transition"
                >
                  <Plus className="w-4 h-4" />
                  เพิ่มสินค้า
                </button>
              </div>

              {/* Service list container */}
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {services.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 border border-dashed border-white/10 rounded-xl bg-neutral-900/10 text-center gap-2">
                    <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm font-semibold text-white">ยังไม่มีสินค้าในแค็ตตาล็อก</span>
                    <span className="text-xs text-muted-foreground">กรุณาป้อนข้อมูลสินค้าหลักหรือสินค้าโปรโมชั่นอย่างน้อย 1 ชิ้น</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {services.map((item) => (
                      <div key={item.id} className="p-4 rounded-xl border border-white/5 bg-neutral-900/40 flex items-start justify-between gap-3 relative">
                        <div className="flex gap-3">
                          {/* Image preview placeholder */}
                          <div className="w-12 h-12 rounded-lg border border-white/10 bg-neutral-950 shrink-0 flex items-center justify-center overflow-hidden">
                            {item.image?.publicUrl ? (
                              <img src={item.image.publicUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <span className="block text-sm font-bold text-white line-clamp-1">{item.name}</span>
                            <span className="block text-xs text-muted-foreground line-clamp-1 mb-1">{item.description || 'ไม่มีคำอธิบาย'}</span>
                            <span className="text-xs font-extrabold text-indigo-400">
                              {(Number(item.priceMinor) / 100).toLocaleString('th-TH')} THB
                            </span>
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => deleteService(item.id)}
                          className="text-muted-foreground hover:text-red-400 p-1 transition shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Step navigation */}
            <div className="pt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm font-semibold text-white hover:bg-white/5 cursor-pointer transition"
              >
                ย้อนกลับ
              </button>
              
              <button
                type="button"
                onClick={onNextStep3}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-sm font-bold text-white shadow-lg cursor-pointer transition"
              >
                ขั้นตอนถัดไป
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Connect Facebook Page */}
        {step === 4 && (
          <div className="space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">เชื่อมต่อช่องทางเผยแพร่ Facebook Page</h2>
                <p className="text-sm text-muted-foreground">อนุญาตสิทธิ์เพื่อให้ AI สามารถดึงข้อมูลและเผยแพร่คอนเทนต์ไปยังเพจของคุณได้ตรงจุด</p>
              </div>

              {fbStatus !== 'connected' ? (
                <div className="flex flex-col items-center justify-center p-8 border border-white/5 bg-neutral-900/40 rounded-xl text-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-indigo-600/10 flex items-center justify-center text-indigo-400">
                    <FacebookIcon className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-white">ต้องการผูกสิทธิ์บัญชี Facebook</span>
                    <span className="block text-xs text-muted-foreground max-w-sm mt-1 leading-normal">
                      ระบบต้องการสิทธิ์ในการจัดการเพจเพื่อจัดสรรและร่างโพสต์อัจฉริยะ คุณสามารถกดยกเลิกสิทธิ์นี้ได้ทุกเมื่อ
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleConnectFacebookOAuth}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#1877F2]/90 text-sm font-bold text-white shadow-lg cursor-pointer transition"
                  >
                    <FacebookIcon className="w-5 h-5 fill-current" />
                    เชื่อมต่อ Facebook Page
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-emerald-400">เชื่อมต่อสิทธิ์บัญชีสำเร็จ</span>
                      <span className="block text-xxs text-muted-foreground">กรุณาเลือก 1 เพจที่ต้องการควบคุมโพสต์ด้านล่างนี้</span>
                    </div>
                  </div>

                  {loadingPages ? (
                    <div className="flex items-center justify-center py-6 gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">กำลังโหลดรายการหน้าเพจของคุณ...</span>
                    </div>
                  ) : fbPages.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-white/10 rounded-xl">
                      <p className="text-xs text-muted-foreground">ไม่พบบัญชี Facebook Page ที่คุณเป็นผู้ดูแลที่มีสิทธิ์บริหารจัดการโพสต์</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-white block">เลือก Facebook Page หลัก <span className="text-red-500">*</span></label>
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {fbPages.map((page) => (
                          <label
                            key={page.fbPageId}
                            onClick={() => setSelectedFbPageId(page.fbPageId)}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                              selectedFbPageId === page.fbPageId
                                ? 'border-primary bg-primary/5'
                                : 'border-white/5 bg-neutral-900/20 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-neutral-950 border border-white/10 overflow-hidden shrink-0">
                                {page.pictureUrl ? (
                                  <img src={page.pictureUrl} alt={page.pageName} className="w-full h-full object-cover" />
                                ) : (
                                  <FacebookIcon className="w-5 h-5 text-muted-foreground m-2" />
                                )}
                              </div>
                              <span className="text-sm font-semibold text-white">{page.pageName}</span>
                            </div>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                              selectedFbPageId === page.fbPageId ? 'border-primary bg-primary text-white' : 'border-white/20'
                            }`}>
                              {selectedFbPageId === page.fbPageId && <Check className="w-3.5 h-3.5" />}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step navigation */}
            <div className="pt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm font-semibold text-white hover:bg-white/5 cursor-pointer transition"
              >
                ย้อนกลับ
              </button>
              
              <button
                type="button"
                disabled={loading || fbStatus !== 'connected' || fbPages.length === 0}
                onClick={handleFinalizeOnboarding}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-sm font-bold text-white shadow-lg disabled:opacity-50 cursor-pointer transition"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                เสร็จสิ้นการตั้งค่า
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step 3 Add Service Product Dialog / Modal */}
      {showAddServiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel glow-indigo rounded-2xl p-6 shadow-2xl animate-scale-up space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">เพิ่มสินค้า/บริการใหม่</h3>
                <p className="text-xs text-muted-foreground">ป้อนรายละเอียดคลังความรู้สำหรับประมวลผลโพสต์</p>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setShowAddServiceModal(false);
                  resetServiceForm();
                  setServiceImageFile(null);
                  setServiceImagePreview(null);
                }} 
                className="text-muted-foreground hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitService(onSubmitService)} className="space-y-4">
              {/* Product Image */}
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-lg border border-white/10 bg-neutral-950 flex items-center justify-center overflow-hidden shrink-0">
                  {serviceImagePreview ? (
                    <img src={serviceImagePreview} alt="Product Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <span className="block text-xs font-semibold text-white mb-1">รูปภาพประกอบสินค้า</span>
                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-xxs font-semibold text-white cursor-pointer transition">
                    <Upload className="w-3 h-3" />
                    เลือกรูปภาพ
                    <input type="file" accept="image/*" className="hidden" onChange={handleServiceImageChange} />
                  </label>
                </div>
              </div>

              {/* Product Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white">ชื่อสินค้า/บริการ <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  {...registerService('name')}
                  placeholder="เช่น แกงไตปลาสูตรเผ็ดร้อน"
                  className="w-full px-3 py-2 rounded-lg border border-white/5 bg-neutral-950 text-xs text-white outline-none focus:border-primary"
                />
                {serviceErrors.name && (
                  <p className="text-xxs text-destructive mt-0.5">{serviceErrors.name.message}</p>
                )}
              </div>

              {/* Product Price */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white">ราคาเสนอขาย (บาท) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  {...registerService('price')}
                  placeholder="เช่น 120.00"
                  className="w-full px-3 py-2 rounded-lg border border-white/5 bg-neutral-950 text-xs text-white outline-none focus:border-primary"
                />
                {serviceErrors.price && (
                  <p className="text-xxs text-destructive mt-0.5">{serviceErrors.price.message}</p>
                )}
              </div>

              {/* Product Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white">รายละเอียดหรือคำโปรยสินค้า</label>
                <textarea
                  rows={3}
                  {...registerService('description')}
                  placeholder="เช่น แกงไตปลาใต้แท้สูตรโบราณ รสเข้มข้นจัดจ้าน เครื่องแกงทำเองส่งตรงจากนครศรีธรรมราช ปริมาณ 250g..."
                  className="w-full px-3 py-2 rounded-lg border border-white/5 bg-neutral-950 text-xs text-white outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddServiceModal(false);
                    resetServiceForm();
                    setServiceImageFile(null);
                    setServiceImagePreview(null);
                  }}
                  className="px-4 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-white hover:bg-white/5 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-xs font-bold text-white shadow-lg disabled:opacity-50 transition"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  บันทึกสินค้า
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OnboardingWizardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">กำลังโหลดหน้าตั้งค่าเริ่มต้น...</p>
      </div>
    }>
      <OnboardingWizardContent />
    </Suspense>
  );
}
