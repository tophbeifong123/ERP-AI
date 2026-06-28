// src/components/features/onboarding/step4-fb-connection.tsx
'use client';

import { Loader2, Check } from 'lucide-react';

import { FacebookPageOption } from '@/core/services/business-service';

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

interface Step4FbConnectionProps {
  fbStatus: 'idle' | 'connected' | 'error';
  fbPages: FacebookPageOption[];
  loadingPages: boolean;
  selectedFbPageId: string | null;
  setSelectedFbPageId: (id: string | null) => void;
  onConnectOAuth: () => void;
  onFinalize: () => Promise<void>;
  loading: boolean;
  onBack: () => void;
}

export default function Step4FbConnection({
  fbStatus,
  fbPages,
  loadingPages,
  selectedFbPageId,
  setSelectedFbPageId,
  onConnectOAuth,
  onFinalize,
  loading,
  onBack,
}: Step4FbConnectionProps) {
  return (
    <div className="space-y-6 flex-1 flex flex-col justify-between animate-fade-in">
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
              onClick={onConnectOAuth}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#1877F2]/90 text-sm font-bold text-white shadow-lg cursor-pointer transition"
            >
              <FacebookIcon className="w-5 h-5 fill-current" />
              เชื่อมต่อ Facebook Page
            </button>
          </div>
        ) : (
          <div className="space-y-4">
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
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-white/10 text-sm font-semibold text-white hover:bg-white/5 cursor-pointer transition"
        >
          ย้อนกลับ
        </button>
        
        <button
          type="button"
          disabled={loading || fbStatus !== 'connected' || fbPages.length === 0}
          onClick={onFinalize}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-sm font-bold text-white shadow-lg disabled:opacity-50 cursor-pointer transition"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          เสร็จสิ้นการตั้งค่า
        </button>
      </div>
    </div>
  );
}
