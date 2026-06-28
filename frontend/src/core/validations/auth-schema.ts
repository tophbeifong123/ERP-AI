import { z } from 'zod';

/**
 * Schema สำหรับตรวจสอบฟอร์ม Login
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'กรุณากรอกอีเมล' })
    .email({ message: 'รูปแบบอีเมลไม่ถูกต้อง' }),
  password: z
    .string()
    .min(1, { message: 'กรุณากรอกรหัสผ่าน' }),
});

/**
 * Schema สำหรับตรวจสอบฟอร์ม Register
 */
export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, { message: 'กรุณากรอกอีเมล' })
      .email({ message: 'รูปแบบอีเมลไม่ถูกต้อง' }),
    password: z
      .string()
      .min(8, { message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร' })
      .max(128, { message: 'รหัสผ่านมีความยาวเกินกำหนด' }),
    confirmPassword: z
      .string()
      .min(1, { message: 'กรุณากรอกยืนยันรหัสผ่าน' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน',
    path: ['confirmPassword'],
  });

/**
 * Schema สำหรับตรวจสอบฟอร์มลืมรหัสผ่าน (Forgot Password)
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'กรุณากรอกอีเมล' })
    .email({ message: 'รูปแบบอีเมลไม่ถูกต้อง' }),
});

/**
 * Schema สำหรับตรวจสอบฟอร์มตั้งรหัสผ่านใหม่ (Reset Password)
 */
export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, { message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร' }),
    confirmNewPassword: z
      .string()
      .min(1, { message: 'กรุณากรอกยืนยันรหัสผ่านใหม่' }),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน',
    path: ['confirmNewPassword'],
  });

/**
 * Schema สำหรับฟอร์มเปลี่ยนรหัสผ่าน (Change Password)
 */
export const changePasswordSchema = z
  .object({
    oldPassword: z
      .string()
      .min(1, { message: 'กรุณากรอกรหัสผ่านเดิม' }),
    newPassword: z
      .string()
      .min(8, { message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร' }),
    confirmNewPassword: z
      .string()
      .min(1, { message: 'กรุณากรอกยืนยันรหัสผ่านใหม่' }),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน',
    path: ['confirmNewPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
