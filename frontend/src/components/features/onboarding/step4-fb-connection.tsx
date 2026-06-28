// src/components/features/onboarding/step4-fb-connection.tsx
'use client';

import React from 'react';
import { ChevronLeft, Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { FacebookPageOption } from '@/core/services/business-service';
import { toast } from 'sonner';

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
          <h2 className="text-xl font-bold text-foreground mb-1">เชื่อมต่อโซเชียลมีเดียปลายทาง</h2>
          <p className="text-sm text-muted-foreground">อนุญาตสิทธิ์บัญชีปลายทางเพื่อให้ AI สามารถช่วยร่างเนื้อหาและเผยแพร่ได้โดยอัตโนมัติ</p>
        </div>

        <div className="space-y-5">
          
          {/* Card 1: Facebook Page Connection (Active OAuth integration) */}
          <div className="p-5 rounded-xl border border-border bg-muted/15 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#1877F2] font-extrabold text-xs shrink-0">
                  <FacebookIcon className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Facebook Page</h3>
                  <p className="text-xxs text-muted-foreground">ระบบส่งข้อมูล Caption และรูปภาพขึ้นหน้าฟีดเพจจริง</p>
                </div>
              </div>
              
              {fbStatus === 'connected' && (
                <span className="inline-flex items-center gap-1 text-xxs text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 block animate-pulse" />
                  เชื่อมต่อสำเร็จ
                </span>
              )}
            </div>

            {fbStatus === 'error' && (
              <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 flex items-start gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="block text-xxs font-bold text-destructive">เกิดข้อผิดพลาดในการเชื่อมโยง Facebook</span>
                  <span className="block text-xxxs text-muted-foreground">สิทธิ์การเชื่อมต่อหมดอายุหรือไม่ถูกต้อง โปรดลองเชื่อมต่อใหม่อีกครั้ง</span>
                </div>
              </div>
            )}

            <div className="pt-1">
              {fbStatus !== 'connected' ? (
                <div className="flex flex-col items-center justify-center py-6 border border-dashed border-border bg-background/30 rounded-xl text-center gap-4">
                  <span className="text-xs text-muted-foreground max-w-xs leading-normal">
                    ระบบต้องการสิทธิ์จัดการเพจเพื่อวิเคราะห์และร่างเนื้อหาโพสต์อัตโนมัติ
                  </span>
                  <button
                    type="button"
                    onClick={onConnectOAuth}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#1877F2]/90 text-xs font-bold text-white shadow shadow-[#1877F2]/15 active:scale-95 transition-all duration-200 cursor-pointer"
                  >
                    <FacebookIcon className="w-4 h-4 fill-current" />
                    เชื่อมต่อ Facebook Page
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-semibold text-muted-foreground">เลือกเพจหลักที่ต้องการผูกเชื่อมโยง <span className="text-red-500">*</span></span>
                    <button
                      type="button"
                      onClick={onConnectOAuth}
                      className="text-xxs text-primary hover:underline flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      สลับบัญชีอื่น
                    </button>
                  </div>

                  {loadingPages ? (
                    <div className="flex items-center gap-2 justify-center py-4 text-xxs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      กำลังค้นหารายการเพจของคุณ...
                    </div>
                  ) : fbPages.length === 0 ? (
                    <div className="p-4 text-center border border-dashed border-border rounded-lg bg-background/30 flex flex-col items-center gap-2">
                      <p className="text-xs font-semibold text-foreground">ไม่พบบัญชี Facebook Page ของคุณ</p>
                      <button
                        type="button"
                        onClick={onConnectOAuth}
                        className="px-3 py-1.5 bg-secondary text-xxs font-bold text-foreground rounded-lg border border-border transition cursor-pointer"
                      >
                        ลองดึงเพจใหม่อีกครั้ง
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {fbPages.map((page) => (
                        <div
                          key={page.fbPageId}
                          onClick={() => setSelectedFbPageId(page.fbPageId)}
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                            selectedFbPageId === page.fbPageId
                              ? 'border-primary bg-primary/10 glow-indigo shadow-sm'
                              : 'border-border bg-background hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-background border border-border overflow-hidden shrink-0 flex items-center justify-center">
                              {page.pictureUrl ? (
                                <img src={page.pictureUrl} alt={page.pageName} className="w-full h-full object-cover" />
                              ) : (
                                <FacebookIcon className="w-4 h-4 text-[#1877F2]" />
                              )}
                            </div>
                            <span className="text-xs font-bold text-foreground">{page.pageName}</span>
                          </div>
                          <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                            selectedFbPageId === page.fbPageId ? 'border-primary bg-primary text-white' : 'border-border'
                          }`}>
                            {selectedFbPageId === page.fbPageId && <Check className="w-2.5 h-2.5" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Instagram Connection Card */}
          <div className="p-5 rounded-xl border border-border bg-muted/15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-xxs shrink-0 mt-0.5 animate-pulse">
                IG
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-foreground">Instagram Business</h3>
                <p className="text-xxs text-muted-foreground leading-relaxed max-w-md">
                  เชื่อมโยงบัญชี Instagram เพื่อให้ AI นำส่งโพสต์แนะนำสินค้าไปขึ้นฟีด IG ได้พร้อมกับเพจ Facebook ในคลิกเดียว
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toast.info('เพื่อเชื่อมต่อ Instagram โปรดผูกบัญชี Instagram Business ของคุณเข้ากับ Facebook Page ด้านบนก่อน ระบบจะดึงข้อมูลมาเชื่อมโยงโดยอัตโนมัติ')}
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xxs font-bold shadow transition cursor-pointer shrink-0"
            >
              เชื่อมต่อ IG
            </button>
          </div>

          {/* Card 3: LINE OA Connection Card */}
          <div className="p-5 rounded-xl border border-border bg-muted/15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-extrabold text-xs shrink-0 mt-0.5 animate-pulse">
                L
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-foreground">LINE Official Account</h3>
                <p className="text-xxs text-muted-foreground leading-relaxed max-w-md">
                  ผูกบัญชี LINE OA เพื่อให้ AI แนะนำตารางการบรอดแคสต์ ส่งโปรโมชั่น หรือจัดทำระบบข้อความตอบกลับหาลูกค้าแบบอัตโนมัติ
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toast.info('สิทธิ์การเชื่อมต่อ LINE Official Account ของคุณกำลังอยู่ในระหว่างตรวจสอบความถูกต้องความปลอดภัยในขั้นตอนนี้')}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xxs font-bold shadow transition cursor-pointer shrink-0"
            >
              เชื่อมต่อ LINE
            </button>
          </div>

        </div>
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
          disabled={loading}
          onClick={onFinalize}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-sm font-bold text-white shadow-lg disabled:opacity-50 cursor-pointer transition"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {finalizeText}
        </button>
      </div>
    </div>
  );
}
