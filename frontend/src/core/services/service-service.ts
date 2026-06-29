// src/core/services/service-service.ts
import apiClient from './api-client';
import { Service } from '../types/service';

export interface CreateServiceData {
  name: string;
  description?: string;
  price: string; // เก็บในระดับหน้าเว็บเป็นบาท เช่น '150.50'
}

export const serviceService = {
  /**
   * สร้างบริการ/สินค้าใหม่ (Step 3)
   */
  async createService(
    businessId: string,
    data: CreateServiceData,
    imageFile?: File
  ): Promise<Service> {
    const formData = new FormData();
    formData.append('name', data.name);
    if (data.description) formData.append('description', data.description);
    
    // แปลงราคาก่อนส่งไปหลังบ้าน: จากบาทเป็น สตางค์ (คูณ 100 แล้วแปลงเป็นจำนวนเต็ม)
    const priceSatang = Math.round(Number(data.price) * 100);
    formData.append('price', priceSatang.toString());
    formData.append('currency', 'THB');

    if (imageFile) {
      formData.append('image', imageFile);
    }

    const response = await apiClient.post<{ service: Service }>(
      `/businesses/${businessId}/services`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.service;
  },

  /**
   * ดึงรายการบริการของธุรกิจทั้งหมด
   */
  async getServices(businessId: string): Promise<Service[]> {
    const response = await apiClient.get<{ services: Service[] }>(
      `/businesses/${businessId}/services`
    );
    return response.data.services;
  },

  /**
   * แก้ไขบริการ/สินค้า
   */
  async updateService(
    serviceId: string,
    data: Partial<CreateServiceData> & { isActive?: boolean },
    imageFile?: File
  ): Promise<Service> {
    if (!imageFile) {
      // Send as JSON for standard field updates (best practice, matches NestJS PATCH DTO)
      const payload: Record<string, any> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.description !== undefined) payload.description = data.description;
      if (data.price !== undefined) {
        payload.price = Math.round(Number(data.price) * 100);
      }
      if (data.isActive !== undefined) payload.isActive = data.isActive;

      const response = await apiClient.patch<{ service: Service }>(
        `/services/${serviceId}`,
        payload
      );
      return response.data.service;
    }

    const formData = new FormData();
    if (data.name) formData.append('name', data.name);
    if (data.description !== undefined) formData.append('description', data.description || '');
    if (data.price) {
      const priceSatang = Math.round(Number(data.price) * 100);
      formData.append('price', priceSatang.toString());
    }
    if (data.isActive !== undefined) {
      formData.append('isActive', data.isActive ? 'true' : 'false');
    }
    formData.append('image', imageFile);

    const response = await apiClient.patch<{ service: Service }>(
      `/services/${serviceId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.service;
  },

  /**
   * ลบบริการ/สินค้า (Soft delete)
   */
  async deleteService(serviceId: string): Promise<void> {
    await apiClient.delete(`/services/${serviceId}`);
  },
};
