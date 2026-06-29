'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Sparkles, Check, Image as ImageIcon, Video } from 'lucide-react';
import { toast } from 'sonner';

import { postService } from '@/core/services/post-service';
import { Service } from '@/core/types/service';
import { PostMediaType, PostType } from '@/core/types/post';

const POST_TYPE_OPTIONS: { value: PostType; label: string; description: string }[] = [
  {
    value: 'promotion',
    label: 'โปรโมชั่น',
    description: 'ลดราคา / โปรโมชั่น / ดีลพิเศษ',
  },
  {
    value: 'product_showcase',
    label: 'แนะนำสินค้า',
    description: 'ไฮไลต์เมนูหรือสินค้าตัวใหม่',
  },
  {
    value: 'brand_awareness',
    label: 'สร้างแบรนด์',
    description: 'เล่าเรื่องราว / ความเป็นมา',
  },
  {
    value: 'event',
    label: 'กิจกรรม',
    description: 'อีเวนต์ / งานสัมมนา / เปิดตัว',
  },
];

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (postId: string) => void;
  businessId: string;
  services: Service[];
  onLoadServices?: () => Promise<Service[]>;
}

export default function CreatePostModal({
  open,
  onClose,
  onCreated,
  businessId,
  services,
  onLoadServices,
}: CreatePostModalProps) {
  const [hint, setHint] = useState('');
  const [postType, setPostType] = useState<PostType>('promotion');
  const [mediaType, setMediaType] = useState<PostMediaType>('image');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [internalServices, setInternalServices] = useState<Service[]>(services);

  useEffect(() => {
    setInternalServices(services);
  }, [services]);

  useEffect(() => {
    if (open && internalServices.length === 0 && onLoadServices) {
      onLoadServices()
        .then((loaded) => setInternalServices(loaded))
        .catch(() => toast.error('โหลดรายการสินค้า/บริการไม่สำเร็จ'));
    }
  }, [open, internalServices.length, onLoadServices]);

  if (!open) return null;

  const reset = () => {
    setHint('');
    setPostType('promotion');
    setMediaType('image');
    setSelectedServiceIds([]);
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hint.trim()) {
      toast.error('กรุณาพิมพ์คำอธิบายสั้นๆ เพื่อให้ AI เริ่มงาน');
      return;
    }
    if (hint.trim().length > 500) {
      toast.error('คำอธิบายต้องไม่เกิน 500 ตัวอักษร');
      return;
    }
    setLoading(true);
    try {
      const { post, jobs } = await postService.createPost({
        businessId,
        hint: hint.trim(),
        postType,
        mediaType,
        featuredServiceIds: selectedServiceIds,
      });
      const mediaLabel = mediaType === 'image' ? 'รูปภาพ' : 'วิดีโอสั้น';
      const mediaPart = jobs.mediaJobId
        ? ` ${mediaLabel}`
        : '';
      toast.success(
        `ส่งงานให้ AI แล้ว! AI กำลังสร้างแคปชั่น${mediaPart} และแนะนำเวลาโพสต์...`,
      );
      reset();
      onClose();
      onCreated(post.id);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || 'ไม่สามารถสร้างโพสต์ได้',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="max-w-2xl w-full bg-white rounded-2xl p-6 sm:p-8 shadow-2xl border border-neutral-100 space-y-5 animate-scale-up max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              สร้างโพสต์ด้วย AI
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              พิมพ์คำอธิบายสั้นๆ → เลือกรูปแบบสื่อ → AI จะช่วยเขียนแคปชั่น สร้างสื่อ และแนะนำเวลาโพสต์ที่เหมาะสม
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer disabled:opacity-50 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Hint textarea */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-800 flex items-center justify-between">
              <span>คำอธิบายสั้นๆ สำหรับ AI *</span>
              <span className="text-xxs text-neutral-400">
                {hint.length} / 500
              </span>
            </label>
            <textarea
              rows={3}
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              disabled={loading}
              placeholder='เช่น "โปรโมชั่นข้าวแกง ลด 50% วันศุกร์นี้ ฟรีค่าส่ง สั่งขั้นต่ำ 200 บาท"'
              className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-950 placeholder-neutral-400 outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary resize-none leading-relaxed transition"
              required
            />
          </div>

          {/* Post type */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-800">
              ประเภทโพสต์
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {POST_TYPE_OPTIONS.map((opt) => {
                const selected = postType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={loading}
                    onClick={() => setPostType(opt.value)}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer disabled:opacity-50 ${
                      selected
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                    }`}
                  >
                    <span className="block text-xs font-bold">{opt.label}</span>
                    <span className={`block text-[10px] leading-snug mt-0.5 opacity-80 ${selected ? 'text-primary' : 'text-neutral-500'}`}>
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Media type */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-800">
              รูปแบบสื่อ
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    value: 'image' as const,
                    label: 'รูปภาพ',
                    icon: ImageIcon,
                    hint: 'AI จะสร้างภาพนิ่ง 1:1',
                  },
                  {
                    value: 'short_video' as const,
                    label: 'วิดีโอสั้น',
                    icon: Video,
                    hint: 'AI จะสร้างวิดีโอแนวตั้ง 9:16',
                  },
                ]
              ).map((opt) => {
                const Icon = opt.icon;
                const selected = mediaType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={loading}
                    onClick={() => setMediaType(opt.value)}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition cursor-pointer disabled:opacity-50 ${
                      selected
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-xs font-bold">{opt.label}</span>
                      <span className={`block text-[10px] leading-snug mt-0.5 opacity-80 ${selected ? 'text-primary' : 'text-neutral-500'}`}>
                        {opt.hint}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Featured services */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-800 flex items-center justify-between">
              <span>สินค้า/บริการที่นำเสนอ (เลือกได้หลายรายการ)</span>
              <span className="text-xxs text-neutral-400">
                เลือกแล้ว {selectedServiceIds.length}
              </span>
            </label>
            {internalServices.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 text-center">
                <p className="text-xs text-neutral-500">
                  ยังไม่มีสินค้า/บริการ — AI จะเขียนโพสต์แบบทั่วไป
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                {internalServices.map((s) => {
                  const selected = selectedServiceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={loading}
                      onClick={() => toggleService(s.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                        selected
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3" />}
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 transition cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading || !hint.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-xs font-bold text-white shadow-lg disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  กำลังส่งงานให้ AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  สร้างโพสต์ด้วย AI
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
