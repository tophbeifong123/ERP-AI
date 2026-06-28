import { apiClient } from './api-client';
import { 
  User, 
  LoginResponse, 
  RefreshResponse, 
  ApiResponse 
} from '../types/auth';
import { 
  LoginInput, 
  RegisterInput, 
  ForgotPasswordInput, 
  ResetPasswordInput, 
  ChangePasswordInput 
} from '../validations/auth-schema';

export const authService = {
  /**
   * สมัครสมาชิกใหม่
   */
  register: async (data: Omit<RegisterInput, 'confirmPassword'>): Promise<ApiResponse<User>> => {
    const response = await apiClient.post<ApiResponse<User>>('/auth/register', data);
    return response.data;
  },

  /**
   * เข้าสู่ระบบ
   */
  login: async (data: LoginInput): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', data);
    return response.data;
  },

  /**
   * หมุนโทเค็นเพื่อขอ Access Token ชุดใหม่
   */
  refreshToken: async (refreshToken: string): Promise<RefreshResponse> => {
    const response = await apiClient.post<RefreshResponse>('/auth/refresh', { refreshToken });
    return response.data;
  },

  /**
   * ออกจากระบบ
   */
  logout: async (refreshToken: string): Promise<void> => {
    await apiClient.post('/auth/logout', { refreshToken });
  },

  /**
   * ร้องขอลิงก์เปลี่ยนรหัสผ่านใหม่ (ลืมรหัสผ่าน)
   */
  forgotPassword: async (data: ForgotPasswordInput): Promise<ApiResponse<never>> => {
    const response = await apiClient.post<ApiResponse<never>>('/auth/forgot-password', data);
    return response.data;
  },

  /**
   * ยืนยันรหัสผ่านใหม่ (Reset Password)
   */
  resetPassword: async (token: string, data: Omit<ResetPasswordInput, 'confirmNewPassword'>): Promise<ApiResponse<never>> => {
    const response = await apiClient.post<ApiResponse<never>>('/auth/reset-password', {
      token,
      newPassword: data.newPassword,
    });
    return response.data;
  },

  /**
   * ยืนยันอีเมลบัญชี (Verify Email)
   */
  verifyEmail: async (token: string): Promise<ApiResponse<never>> => {
    const response = await apiClient.post<ApiResponse<never>>('/auth/verify-email', { token });
    return response.data;
  },

  /**
   * เปลี่ยนรหัสผ่านขณะล็อกอินอยู่ (Change Password)
   */
  changePassword: async (data: Omit<ChangePasswordInput, 'confirmNewPassword'>): Promise<ApiResponse<never>> => {
    const response = await apiClient.post<ApiResponse<never>>('/auth/change-password', {
      oldPassword: data.oldPassword,
      newPassword: data.newPassword,
    });
    return response.data;
  },

  /**
   * ดึงข้อมูลโปรไฟล์ผู้ใช้ปัจจุบัน
   */
  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/me');
    return response.data;
  },

  /**
   * ลบบัญชีผู้ใช้ตนเอง (Soft Delete)
   */
  deleteMe: async (): Promise<void> => {
    await apiClient.delete('/me');
  },
};
