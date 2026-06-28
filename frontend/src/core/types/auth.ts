// src/core/types/auth.ts

/**
 * ข้อมูลผู้ใช้งานที่เข้าสู่ระบบ
 */
export interface User {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * ข้อมูลผลลัพธ์เมื่อล็อกอินสำเร็จ
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/**
 * ข้อมูลผลลัพธ์เมื่อทำการขอ Refresh Token ใหม่
 */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * ข้อมูลผลลัพธ์มาตรฐานของการตอบกลับจาก API
 */
export interface ApiResponse<T> {
  resource?: T;
  message?: string;
  [key: string]: unknown;
}
