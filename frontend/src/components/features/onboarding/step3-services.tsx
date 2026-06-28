// src/components/features/onboarding/step3-services.tsx
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShoppingBag, Plus, Trash2, X, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Service } from '@/core/types/service';
import { serviceSchema, ServiceInput } from '@/core/validations/service-schema';
import { serviceService } from '@/core/services/service-service';

interface Step3ServicesProps {
  activeBusinessId: string;
  services: Service[];
  setServices: (services: Service[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step3Services({
  activeBusinessId,
  services,
  setServices,
  onNext,
  onBack,
}: Step3ServicesProps) {
  const [loading, setLoading] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [serviceImageFile, setServiceImageFile] = useState<File | null>(null);
  const [serviceImagePreview, setServiceImagePreview] = useState<string | null>(null);

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
    onNext();
  };

  return (
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
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white flex items-center gap-1 transition cursor-pointer"
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
                    className="text-muted-foreground hover:text-red-400 p-1 transition shrink-0 cursor-pointer"
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
          onClick={onBack}
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

      {/* Add Service Product Dialog / Modal */}
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
                className="text-muted-foreground hover:text-white p-1 cursor-pointer"
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
                  className="w-full px-3 py-2 rounded-lg border border-white/5 bg-neutral-955 text-xs text-white outline-none focus:border-primary"
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
                  className="w-full px-3 py-2 rounded-lg border border-white/5 bg-neutral-955 text-xs text-white outline-none focus:border-primary"
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
                  className="w-full px-3 py-2 rounded-lg border border-white/5 bg-neutral-955 text-xs text-white outline-none focus:border-primary resize-none"
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
                  className="px-4 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-white hover:bg-white/5 transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-xs font-bold text-white shadow-lg disabled:opacity-50 transition cursor-pointer"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
