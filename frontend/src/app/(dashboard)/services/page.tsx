// src/app/(dashboard)/services/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Trash2, 
  Edit3, 
  Upload, 
  X, 
  Loader2, 
  Check, 
  ToggleLeft, 
  ToggleRight 
} from 'lucide-react';
import { useBusinessStore } from '@/hooks/store/use-business-store';
import { serviceService } from '@/core/services/service-service';
import { Service } from '@/core/types/service';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { serviceSchema, ServiceInput } from '@/core/validations/service-schema';

export default function ServicesPage() {
  const { activeBusiness } = useBusinessStore();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const activeBusinessId = activeBusiness?.id;

  const loadServices = async () => {
    if (!activeBusinessId) return;
    setLoading(true);
    try {
      const data = await serviceService.getServices(activeBusinessId);
      setServices(data);
    } catch (err) {
      toast.error('ไม่สามารถโหลดข้อมูลสินค้า/บริการได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadServices();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ServiceInput>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      description: '',
      price: '',
    },
  });

  const handleOpenAddModal = () => {
    setEditingService(null);
    setImageFile(null);
    setImagePreview(null);
    reset({
      name: '',
      description: '',
      price: '',
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (service: Service) => {
    setEditingService(service);
    setImageFile(null);
    setImagePreview(service.image?.publicUrl || null);
    reset({
      name: service.name,
      description: service.description || '',
      price: (Number(service.priceMinor) / 100).toString(),
    });
    setModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('ขนาดภาพห้ามเกิน 5MB');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: ServiceInput) => {
    if (!activeBusinessId) return;
    setSubmitLoading(true);
    try {
      if (editingService) {
        // แก้ไขสินค้า
        const updated = await serviceService.updateService(
          editingService.id,
          {
            name: data.name,
            description: data.description,
            price: data.price,
          },
          imageFile || undefined
        );
        toast.success('แก้ไขข้อมูลสินค้าเรียบร้อยแล้ว');
        setServices(services.map((s) => (s.id === editingService.id ? updated : s)));
      } else {
        // เพิ่มสินค้าใหม่
        const created = await serviceService.createService(
          activeBusinessId,
          {
            name: data.name,
            description: data.description,
            price: data.price,
          },
          imageFile || undefined
        );
        toast.success('เพิ่มสินค้าใหม่ลงในคลังเรียบร้อยแล้ว');
        setServices([created, ...services]);
      }
      setModalOpen(false);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'การดำเนินการล้มเหลว');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณแน่ใจว่าต้องการลบสินค้านี้ออกใช่หรือไม่?')) return;
    try {
      await serviceService.deleteService(id);
      toast.success('ลบสินค้าเรียบร้อยแล้ว');
      setServices(services.filter((s) => s.id !== id));
    } catch (err) {
      toast.error('ไม่สามารถลบสินค้าได้');
    }
  };

  const handleToggleActive = async (service: Service) => {
    try {
      const newStatus = !service.isActive;
      const updated = await serviceService.updateService(service.id, {
        isActive: newStatus,
      });
      setServices(services.map((s) => (s.id === service.id ? updated : s)));
      toast.success(newStatus ? 'เปิดใช้งานสินค้าแล้ว' : 'ปิดใช้งานสินค้าชั่วคราว');
    } catch (err) {
      toast.error('ไม่สามารถสลับสถานะเปิด/ปิดใช้งานได้');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">จัดการสินค้า/บริการ</h1>
            <p className="text-sm text-muted-foreground">บันทึกสินค้าและบริการเพื่อให้ระบบ AI หยิบใช้เป็นคลังข้อมูลแต่งคอนเทนต์อย่างแม่นยำ</p>
          </div>
        </div>
        
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-xs font-bold text-white shadow shadow-primary/20 transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          เพิ่มสินค้าใหม่
        </button>
      </div>

      {/* Main Grid List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 text-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground">กำลังโหลดคลังสินค้าของคุณ...</span>
        </div>
      ) : services.length === 0 ? (
        <div className="glass-panel rounded-xl p-16 flex flex-col items-center justify-center text-center gap-3 max-w-lg mx-auto">
          <ShoppingBag className="w-12 h-12 text-muted-foreground animate-pulse" />
          <span className="text-sm font-bold text-foreground">ยังไม่มีสินค้าในแค็ตตาล็อก</span>
          <p className="text-xs text-muted-foreground leading-normal max-w-sm">
            กรุณาป้อนข้อมูลสินค้าหลักหรือสินค้าโปรโมชั่นของคุณอย่างน้อย 1 ชิ้น เพื่อเป็นคลังความรู้สำหรับ AI ในการหยิบเขียนโปรโมทสะกดใจลูกค้า
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/95 text-xs font-bold text-white transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            เพิ่มสินค้ารายการแรก
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((item) => {
            const price = (Number(item.priceMinor) / 100).toLocaleString('th-TH');
            return (
              <div 
                key={item.id} 
                className={`glass-panel rounded-xl p-5 flex flex-col justify-between gap-4 transition hover:border-white/12 relative ${
                  !item.isActive ? 'opacity-65' : ''
                }`}
              >
                <div className="flex gap-4">
                  {/* Image Container */}
                  <div className="w-16 h-16 rounded-xl border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
                    {item.image?.publicUrl ? (
                      <img src={item.image.publicUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag className="w-7 h-7 text-muted-foreground" />
                    )}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <span className="block text-sm font-bold text-foreground truncate pr-6">{item.name}</span>
                    <span className="block text-xs font-extrabold text-primary">{price} THB</span>
                    <p className="text-xxs text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.description || 'ไม่มีคำอธิบายหรือคำโปรยสินค้า'}
                    </p>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between border-t border-border/40 pt-3">
                  <button
                    onClick={() => handleToggleActive(item)}
                    className="flex items-center gap-1 text-xxs text-muted-foreground hover:text-foreground transition cursor-pointer"
                  >
                    {item.isActive ? (
                      <>
                        <ToggleRight className="w-5 h-5 text-emerald-500" />
                        <span className="font-semibold text-emerald-500">เปิดการขาย</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-5 h-5" />
                        <span>ปิดชั่วคราว</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      className="p-1.5 rounded bg-secondary hover:bg-white/10 text-muted-foreground hover:text-foreground transition cursor-pointer"
                      title="แก้ไขข้อมูล"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded bg-secondary hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition cursor-pointer"
                      title="ลบสินค้า"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Product Dialog Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel glow-indigo rounded-2xl p-6 shadow-2xl animate-scale-up space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {editingService ? 'แก้ไขข้อมูลสินค้า/บริการ' : 'เพิ่มสินค้า/บริการใหม่'}
                </h3>
                <p className="text-xs text-muted-foreground">ป้อนข้อมูลรายละเอียดของสินค้าป้อนเข้าสู่ระบบประมวลผล AI</p>
              </div>
              <button 
                type="button" 
                onClick={() => setModalOpen(false)} 
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Product Image Selection */}
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-lg border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <span className="block text-xs font-semibold text-foreground mb-1">รูปภาพประกอบสินค้า</span>
                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary hover:bg-secondary/80 border border-border text-xxs font-semibold text-foreground cursor-pointer transition">
                    <Upload className="w-3 h-3" />
                    เลือกรูปภาพ
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                </div>
              </div>

              {/* Product Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">ชื่อสินค้า/บริการ <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  {...register('name')}
                  placeholder="เช่น ชาใต้แท้ 100% บรรจุขวด"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                {errors.name && (
                  <p className="text-xxs text-red-500 mt-0.5">{errors.name.message}</p>
                )}
              </div>

              {/* Product Price */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">ราคาเสนอขาย (บาท) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  {...register('price')}
                  placeholder="เช่น 45.00"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                {errors.price && (
                  <p className="text-xxs text-red-500 mt-0.5">{errors.price.message}</p>
                )}
              </div>

              {/* Product Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">รายละเอียดหรือคำโปรยสินค้า</label>
                <textarea
                  rows={3}
                  {...register('description')}
                  placeholder="เช่น ชาใต้ออริจินัลสูตรนครศรีฯ รสชาติฝาดมันเข้มข้น หวานพอดี ปริมาณ 250ml ไม่ผสมสีสังเคราะห์..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-xs font-bold text-white shadow-lg disabled:opacity-50 transition cursor-pointer"
                >
                  {submitLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingService ? 'บันทึกการแก้ไข' : 'บันทึกสินค้า'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
