// src/components/features/onboarding/step1-business-form.tsx
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  ChevronLeft,
  Briefcase, 
  Upload, 
  X, 
  AlertCircle, 
  Loader2 
} from 'lucide-react';
import { toast } from 'sonner';

import { createBusinessSchema, CreateBusinessInput } from '@/core/validations/business-schema';

type Tone = 'friendly' | 'professional' | 'playful' | 'luxurious' | 'minimal';

interface Step1BusinessFormProps {
  onSubmit: (data: CreateBusinessInput, logoFile: File | null) => Promise<void>;
  loading: boolean;
  onBack?: () => void;
  defaultValues?: Partial<CreateBusinessInput>;
  defaultLogoUrl?: string | null;
  hideBack?: boolean;
}

export default function Step1BusinessForm({ 
  onSubmit, 
  loading, 
  onBack,
  defaultValues,
  defaultLogoUrl,
  hideBack = false
}: Step1BusinessFormProps) {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateBusinessInput>({
    resolver: zodResolver(createBusinessSchema),
    defaultValues: defaultValues || {
      name: '',
      industry: '',
      description: '',
      targetAudience: '',
      tone: 'friendly',
      keywords: [],
    },
  });

  // คอยอัปเดตฟอร์มเมื่อค่าเริ่มต้นเปลี่ยนแปลง
  React.useEffect(() => {
    if (defaultValues) {
      reset(defaultValues);
    }
  }, [defaultValues, reset]);

  // คอยอัปเดตโลโก้ปัจจุบันของแบรนด์
  React.useEffect(() => {
    if (defaultLogoUrl) {
      setLogoPreview(defaultLogoUrl);
    }
  }, [defaultLogoUrl]);

  const keywords = watch('keywords') || [];
  const selectedTone = watch('tone');

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

  const addKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = keywordInput.trim();
      if (!val) return;
      if (keywords.includes(val)) {
        toast.error('คำหลักนี้ถูกเพิ่มไว้แล้ว');
        return;
      }
      const newKeywords = [...keywords, val];
      setValue('keywords', newKeywords, { shouldValidate: true });
      setKeywordInput('');
    }
  };

  const removeKeyword = (kw: string) => {
    const newKeywords = keywords.filter((k) => k !== kw);
    setValue('keywords', newKeywords, { shouldValidate: true });
  };

  const handleFormSubmit = (data: CreateBusinessInput) => {
    onSubmit(data, logoFile);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 flex-1 flex flex-col justify-between">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">ข้อมูลหลักแบรนด์ธุรกิจ</h2>
          <p className="text-sm text-muted-foreground">บันทึกข้อมูลเพื่อเป็นแนวทางให้ AI เข้าใจแบรนด์ของคุณและวางแผนนำเสนอโพสต์</p>
        </div>

        {/* Logo Upload */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-border bg-muted/20">
          <div className="relative w-20 h-20 rounded-xl border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-cover" />
            ) : (
              <Briefcase className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 w-full text-center sm:text-left">
            <span className="block text-sm font-medium text-foreground mb-1">อัปโหลดโลโก้ร้านค้า</span>
            <p className="text-xs text-muted-foreground mb-2">รองรับรูปภาพ JPG, PNG (ขนาดไม่เกิน 5MB)</p>
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-xs font-semibold text-foreground cursor-pointer transition">
              <Upload className="w-3.5 h-3.5" />
              เลือกรูปภาพ
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Brand Name */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground block">ชื่อธุรกิจ / ร้านค้า <span className="text-red-500">*</span></label>
            <input
              type="text"
              {...register('name')}
              placeholder="เช่น ข้าวแกงเดลิเวอรี่เฮ้าส์"
              className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
            />
            {errors.name && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" /> {errors.name.message}
              </p>
            )}
          </div>

          {/* Industry */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground block">ประเภทหมวดหมู่อุตสาหกรรม <span className="text-red-500">*</span></label>
            <input
              type="text"
              {...register('industry')}
              placeholder="เช่น อาหารและเครื่องดื่ม, ท่องเที่ยว, เสื้อผ้า"
              className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
            />
            {errors.industry && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" /> {errors.industry.message}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground block">จุดเด่นหรือลักษณะธุรกิจโดยสังเขป</label>
          <textarea
            rows={3}
            {...register('description')}
            placeholder="ช่วยเขียนอธิบายจุดขายหลัก หรือแนวคิดบริการของแบรนด์คุณ เพื่อนำไปประมวลผล..."
            className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition resize-none"
          />
        </div>

        {/* Target Audience */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground block">กลุ่มเป้าหมายหลัก</label>
          <input
            type="text"
            {...register('targetAudience')}
            placeholder="เช่น วัยทำงานช่วงอายุ 25-45 ปี ที่ชื่นชอบความสะดวกและอาหารรสจัด"
            className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
          />
        </div>

        {/* Brand Tone */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground block">น้ำเสียงและสไตล์ของโพสต์ที่ต้องการ <span className="text-red-500">*</span></label>
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
                onClick={() => setValue('tone', t.key as Tone, { shouldValidate: true })}
                className={`py-2 px-1 rounded-lg border text-xs font-semibold transition ${
                  selectedTone === t.key
                    ? 'border-primary bg-primary/10 text-primary shadow-md'
                    : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                }`}
              >
                {t.l}
              </button>
            ))}
          </div>
        </div>

        {/* Keywords (Tag Input) */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground block">คีย์เวิร์ดสำคัญสำหรับการขาย (สะกดคำค้นหา) <span className="text-red-500">*</span></label>
          <div className="flex flex-wrap gap-2 p-2 rounded-lg border border-border bg-background min-h-[42px] items-center">
            {keywords.map((kw) => (
              <span key={kw} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary/10 border border-primary/20 text-primary">
                {kw}
                <button type="button" onClick={() => removeKeyword(kw)} className="hover:text-red-400 cursor-pointer">
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
              className="border-none bg-transparent outline-none text-xs text-foreground p-0.5 flex-1 min-w-[120px]"
            />
          </div>
          <p className="text-xxs text-muted-foreground">เช่น &quot;แกงใต้แท้&quot;, &quot;ส่งฟรี&quot;, &quot;สูตรลับคุณยาย&quot; (กรอกอย่างน้อย 1 คำ)</p>
          {errors.keywords && (
            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" /> {errors.keywords.message}
            </p>
          )}
        </div>
      </div>

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
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-sm font-bold text-white shadow-lg disabled:opacity-50 cursor-pointer transition"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {hideBack ? 'บันทึกการเปลี่ยนแปลง' : 'ขั้นตอนถัดไป'}
        </button>
      </div>
    </form>
  );
}
