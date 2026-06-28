import { create } from 'zustand';
import { User } from '../../core/types/auth';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
}

/**
 * Zustand Store สำหรับจัดการสถานะ Authentication
 * จัดเก็บ Access Token และข้อมูลผู้ใช้ไว้ใน Memory เพื่อความปลอดภัยสูงสุด (XSS Protection)
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  /**
   * ตั้งค่าข้อมูลผู้ใช้และโทเค็นเมื่อล็อกอินสำเร็จ
   */
  setAuth: (user, accessToken) =>
    set({
      user,
      accessToken,
      isAuthenticated: true,
    }),

  /**
   * อัปเดตเฉพาะ Access Token เมื่อมีการหมุนโทเค็นใหม่ (Token Rotation)
   */
  setAccessToken: (accessToken) =>
    set((state) => ({
      ...state,
      accessToken,
    })),

  /**
   * ล้างข้อมูลการเข้าสู่ระบบทั้งหมด (เมื่อ Logout หรือ Session หมดอายุ)
   */
  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    }),
}));
