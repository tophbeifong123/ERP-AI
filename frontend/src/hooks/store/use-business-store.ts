// src/hooks/store/use-business-store.ts
import { create } from 'zustand';
import { Business } from '../../core/types/business';
import { businessService } from '../../core/services/business-service';

interface BusinessState {
  businesses: Business[];
  activeBusinessId: string | null;
  activeBusiness: Business | null;
  isLoading: boolean;
  error: string | null;

  setBusinesses: (businesses: Business[]) => void;
  setActiveBusinessId: (id: string | null) => void;
  fetchBusinesses: () => Promise<Business[]>;
  fetchActiveBusiness: (id: string) => Promise<Business>;
  clearBusinessStore: () => void;
}

export const useBusinessStore = create<BusinessState>((set, get) => ({
  businesses: [],
  activeBusinessId: typeof window !== 'undefined' ? localStorage.getItem('active_business_id') : null,
  activeBusiness: null,
  isLoading: false,
  error: null,

  setBusinesses: (businesses) => {
    set({ businesses });
  },

  setActiveBusinessId: (id) => {
    set({ activeBusinessId: id });
    if (id) {
      localStorage.setItem('active_business_id', id);
      // ค้นหาในลิสต์ที่โหลดมาอยู่แล้ว
      const found = get().businesses.find((b) => b.id === id);
      if (found) {
        set({ activeBusiness: found });
      }
    } else {
      localStorage.removeItem('active_business_id');
      set({ activeBusiness: null });
    }
  },

  fetchBusinesses: async () => {
    set({ isLoading: true, error: null });
    try {
      const businesses = await businessService.getBusinesses();
      set({ businesses, isLoading: false });
      
      // ถ้ามี ID เดิมที่เคยเก็บไว้ ให้ดึงแบรนด์นั้นขึ้นมาทำงาน
      const savedId = get().activeBusinessId;
      if (savedId) {
        const found = businesses.find((b) => b.id === savedId);
        if (found) {
          set({ activeBusiness: found });
        } else if (businesses.length > 0) {
          // ถ้าไม่เจอบนรายการ ให้รีเซ็ตหรือเลือกตัวแรกแทน
          get().setActiveBusinessId(businesses[0].id);
        }
      } else if (businesses.length > 0) {
        // เลือกตัวแรกถ้าไม่มีที่เก็บไว้เลย
        get().setActiveBusinessId(businesses[0].id);
      }
      return businesses;
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const message = axiosError.response?.data?.message || 'ไม่สามารถโหลดข้อมูลธุรกิจได้';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  fetchActiveBusiness: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const business = await businessService.getBusiness(id);
      set({ activeBusiness: business, activeBusinessId: id, isLoading: false });
      localStorage.setItem('active_business_id', id);
      return business;
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const message = axiosError.response?.data?.message || 'ไม่สามารถโหลดรายละเอียดธุรกิจได้';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  clearBusinessStore: () => {
    localStorage.removeItem('active_business_id');
    set({
      businesses: [],
      activeBusinessId: null,
      activeBusiness: null,
      isLoading: false,
      error: null,
    });
  },
}));
