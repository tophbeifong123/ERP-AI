// src/components/features/onboarding/step4-fb-connection.tsx
'use client';

import React from 'react';
import { ChevronLeft, Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react';
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
  onBack?: () => void;
  hideBack?: boolean;
  finalizeText?: string;
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
  hideBack = false,
  finalizeText = 'เสร็จสิ้นการตั้งค่า',
}: Step4FbConnectionProps) {
  return (
    <div className="space-y-6 flex-1 flex flex-col justify-between animate-fade-in">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">เชื่อมต่อช่องทางเผยแพร่ Facebook Page</h2>
          <p className="text-sm text-muted-foreground">อนุญาตสิทธิ์เพื่อให้ AI สามารถดึงข้อมูลและเผยแพร่คอนเทนต์ไปยังเพจของคุณได้ตรงจุด</p>
        </div>

        {fbStatus === 'error' && (
          <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 flex items-start gap-3 animate-shake">
            <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="block text-xs font-bold text-destructive">เกิดข้อผิดพลาดในการเชื่อมต่อ</span>
              <span className="block text-xxs text-muted-foreground">การดึงสิทธิ์โทเค็นจาก Facebook ล้มเหลวหรือถูกปฏิเสธ กรุณาลองใหม่อีกครั้ง</span>
            </div>
          </div>
        )}

        {fbStatus !== 'connected' ? (
          <div className="flex flex-col items-center justify-center p-8 border border-border bg-muted/20 rounded-2xl text-center gap-5 relative overflow-hidden transition-all duration-300 hover:border-primary/30">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-inner animate-pulse">
              <FacebookIcon className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <span className="block text-base font-bold text-foreground">ต้องการผูกสิทธิ์บัญชี Facebook</span>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                ระบบต้องการสิทธิ์จัดการเพจเพื่อวิเคราะห์ วางกำหนดการโพสต์ และร่างเนื้อหาโดยอัตโนมัติ คุณสามารถเข้ามายกเลิกสิทธิ์นี้ได้ทุกเมื่ออย่างปลอดภัย
              </p>
            </div>
            <button
              type="button"
              onClick={onConnectOAuth}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#1877F2] hover:bg-[#1877F2]/90 text-sm font-bold text-white shadow-lg shadow-[#1877F2]/20 hover:shadow-[#1877F2]/30 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <FacebookIcon className="w-5 h-5 fill-current" />
              เชื่อมต่อ Facebook Page
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 dark:text-emerald-400 shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <span className="block text-xs font-bold text-emerald-500 dark:text-emerald-400">เชื่อมต่อสิทธิ์บัญชีสำเร็จ</span>
                <span className="block text-xxs text-muted-foreground">กรุณาเลือกเพจหลัก 1 เพจจากรายการด้านล่าง เพื่อควบคุมโพสต์อัจฉริยะ</span>
              </div>
              <button
                type="button"
                onClick={onConnectOAuth}
                className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer shrink-0 font-medium"
              >
                <RefreshCw className="w-3 h-3" />
                สลับบัญชีอื่น
              </button>
            </div>

            {loadingPages ? (
              <div className="space-y-3 py-4">
                <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  กำลังดึงข้อมูลเพจของท่านจาก Facebook...
                </div>
                {/* Skeleton Page Loaders */}
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/10 opacity-60">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
                        <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                      </div>
                      <div className="w-5 h-5 rounded-full bg-muted animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ) : fbPages.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border rounded-xl bg-muted/5 flex flex-col items-center gap-3">
                <AlertCircle className="w-8 h-8 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">ไม่พบบัญชี Facebook Page ของคุณ</p>
                  <p className="text-xs text-muted-foreground max-w-xs leading-normal">
                    กรุณาตรวจสอบว่าบัญชีที่ใช้เข้าสู่ระบบมีสิทธิ์เป็นผู้ดูแล (Admin) ในเพจ Facebook หรือยืนยันสิทธิ์อีกครั้ง
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onConnectOAuth}
                  className="px-4 py-2 bg-secondary hover:bg-secondary/80 border border-border text-xs font-semibold text-foreground rounded-lg transition cursor-pointer"
                >
                  ลองต่อสิทธิ์ใหม่อีกครั้ง
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground block">เลือก Facebook Page หลัก <span className="text-red-500">*</span></label>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {fbPages.map((page) => (
                    <div
                      key={page.fbPageId}
                      onClick={() => setSelectedFbPageId(page.fbPageId)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md ${
                        selectedFbPageId === page.fbPageId
                          ? 'border-primary bg-primary/10 glow-indigo shadow-sm'
                          : 'border-border bg-background hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-background border border-border overflow-hidden shrink-0">
                          {page.pictureUrl ? (
                            <img src={page.pictureUrl} alt={page.pageName} className="w-full h-full object-cover" />
                          ) : (
                            <FacebookIcon className="w-5 h-5 text-muted-foreground m-2" />
                          )}
                        </div>
                        <span className="text-sm font-semibold text-foreground">{page.pageName}</span>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        selectedFbPageId === page.fbPageId ? 'border-primary bg-primary text-white' : 'border-border'
                      }`}>
                        {selectedFbPageId === page.fbPageId && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step navigation */}
      <div className={`pt-6 flex flex-col-reverse gap-3 sm:flex-row ${hideBack ? 'sm:justify-end' : 'sm:justify-between'}`}>
        {!hideBack && onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50 cursor-pointer transition"
          >
            <ChevronLeft className="w-4 h-4" />
            ย้อนกลับ
          </button>
        )}
        
        <button
          type="button"
          disabled={loading || fbStatus !== 'connected' || fbPages.length === 0}
          onClick={onFinalize}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-sm font-bold text-white shadow-lg disabled:opacity-50 cursor-pointer transition"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {finalizeText}
        </button>
      </div>
    </div>
  );
}
