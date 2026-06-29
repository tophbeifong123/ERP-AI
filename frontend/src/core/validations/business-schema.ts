import { z } from 'zod';

/**
 * Schema สำหรับกรอกข้อมูลตั้งค่าธุรกิจแบรนด์ (Step 1)
 */
export const createBusinessSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'กรุณากรอกชื่อธุรกิจอย่างน้อย 2 ตัวอักษร' })
    .max(200, { message: 'ชื่อธุรกิจยาวเกิน 200 ตัวอักษร' }),
  industry: z
    .string()
    .min(1, { message: 'กรุณาระบุหมวดหมู่อุตสาหกรรมธุรกิจ' })
    .max(100),
  description: z
    .string()
    .max(2000, { message: 'คำอธิบายห้ามยาวเกิน 2000 ตัวอักษร' })
    .optional()
    .or(z.literal('')),
  targetAudience: z
    .string()
    .max(500, { message: 'กลุ่มเป้าหมายห้ามยาวเกิน 500 ตัวอักษร' })
    .optional()
    .or(z.literal('')),
  tone: z.enum(['friendly', 'professional', 'playful', 'luxurious', 'minimal']),
  keywords: z
    .array(z.string())
    .min(1, { message: 'กรุณาระบุคีย์เวิร์ดสำหรับโฆษณาอย่างน้อย 1 คำ' }),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
