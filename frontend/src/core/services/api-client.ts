import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../../hooks/store/use-auth-store';
import { RefreshResponse } from '../types/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * สร้าง Axios instance หลักสำหรับติดต่อ API
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// กำหนดโครงสร้าง custom config เพื่อป้องกัน infinite loop ในการ refresh token
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/**
 * Request Interceptor: แนบ Access Token เข้าไปกับ Header เสมอถ้ามี
 */
apiClient.interceptors.request.use(
  (config) => {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor: จัดการเรื่อง Refresh Token (Token Rotation) อัตโนมัติเมื่อเจอรหัส 401
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    // ถ้าไม่ใช่รหัส 401 หรือไม่มี config หรือคำขอนี้เคยลอง refresh ไปแล้ว ให้ส่ง error ออกไปเลย
    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;

    if (!refreshToken) {
      // ไม่มี refresh token ให้เคลียร์ auth ใน store และพาไปหน้า login
      useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    }

    try {
      // ส่งขอ refresh token ใหม่ไปยัง backend
      const response = await axios.post<RefreshResponse>(
        `${API_BASE_URL}/auth/refresh`,
        { refreshToken },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

      // อัปเดตโทเค็นในระบบ
      useAuthStore.getState().setAccessToken(newAccessToken);
      if (typeof window !== 'undefined') {
        localStorage.setItem('refresh_token', newRefreshToken);
      }

      // ส่งคำขอดั้งเดิมใหม่อีกครั้งโดยเปลี่ยน Access Token ตัวใหม่
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      }
      return apiClient(originalRequest);
    } catch (refreshError) {
      // หากการขอ refresh token ล้มเหลว (เช่น Token หมดอายุไปแล้วจริง) ให้เคลียร์ auth
      useAuthStore.getState().clearAuth();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    }
  }
);
