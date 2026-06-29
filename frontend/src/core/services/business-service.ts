// src/core/services/business-service.ts
import apiClient from './api-client';
import { Business } from '../types/business';

export interface CreateBusinessData {
  name: string;
  industry: string;
  description?: string;
  targetAudience?: string;
  tone: string;
  keywords: string[];
}

export interface FacebookPageOption {
  fbPageId: string;
  pageName: string;
  pictureUrl: string | null;
}

export const businessService = {
  /**
   * สร้างธุรกิจใหม่
   */
  async createBusiness(data: CreateBusinessData, logoFile?: File): Promise<Business> {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('industry', data.industry);
    if (data.description) formData.append('description', data.description);
    if (data.targetAudience) formData.append('targetAudience', data.targetAudience);
    formData.append('tone', data.tone);
    formData.append('keywords', JSON.stringify(data.keywords));
    
    if (logoFile) {
      formData.append('logo', logoFile);
    }

    const response = await apiClient.post<{ business: Business }>('/businesses', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.business;
  },

  /**
   * ดึงรายการธุรกิจของผู้ใช้ทั้งหมด
   */
  async getBusinesses(): Promise<Business[]> {
    const response = await apiClient.get<{ businesses: Business[] }>('/businesses');
    return response.data.businesses;
  },

  /**
   * ดึงข้อมูลธุรกิจเดี่ยวๆ
   */
  async getBusiness(id: string): Promise<Business> {
    const response = await apiClient.get<{ business: Business }>(`/businesses/${id}`);
    return response.data.business;
  },

  /**
   * อัปโหลดโลโก้เพิ่มเติม
   */
  async uploadLogo(id: string, file: File): Promise<{ logoUrl: string }> {
    const formData = new FormData();
    formData.append('logo', file);
    const response = await apiClient.post<{ logoUrl: string }>(`/businesses/${id}/logo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * ดึงรายการ Facebook Page ที่สิทธิ์ของผู้ใช้เข้าถึงได้ (Step 4)
   */
  async getFacebookPages(businessId: string): Promise<FacebookPageOption[]> {
    const response = await apiClient.get<{ pages: FacebookPageOption[] }>(
      `/facebook/pages?businessId=${businessId}`
    );
    return response.data.pages;
  },

  async connectFacebookPage(businessId: string, fbPageId: string): Promise<unknown> {
    const response = await apiClient.post(
      `/facebook/businesses/${businessId}/facebook-pages`,
      { fbPageId }
    );
    return response.data;
  },

  /**
   * อัปเดตข้อมูลทั่วไปของธุรกิจ (PATCH /businesses/:id)
   */
  async updateBusiness(id: string, data: Partial<CreateBusinessData>, logoFile?: File): Promise<Business> {
    const formData = new FormData();
    if (data.name) formData.append('name', data.name);
    if (data.industry) formData.append('industry', data.industry);
    if (data.description !== undefined) formData.append('description', data.description || '');
    if (data.targetAudience !== undefined) formData.append('targetAudience', data.targetAudience || '');
    if (data.tone) formData.append('tone', data.tone);
    if (data.keywords) formData.append('keywords', JSON.stringify(data.keywords));

    if (logoFile) {
      formData.append('logo', logoFile);
    }

    const response = await apiClient.patch<{ business: Business }>(`/businesses/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.business;
  },

  /**
   * ลบธุรกิจ (DELETE /businesses/:id)
   */
  async deleteBusiness(id: string): Promise<void> {
    await apiClient.delete(`/businesses/${id}`);
  },

  /**
   * ยกเลิกการผูกเพจ Facebook (DELETE /facebook/businesses/:id/facebook-pages/:pageId)
   */
  async disconnectFacebookPage(businessId: string, pageId: string): Promise<void> {
    await apiClient.delete(
      `/facebook/businesses/${businessId}/facebook-pages/${pageId}`
    );
  },
};
