import { z } from 'zod';

/**
 * Schema สำหรับกรอกข้อมูลสินค้า/บริการ (Step 3)
 */
export const serviceSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'กรุณากรอกชื่อสินค้าอย่างน้อย 2 ตัวอักษร' })
    .max(100, { message: 'ชื่อสินค้าห้ามเกิน 100 ตัวอักษร' }),
  description: z
    .string()
    .max(1000, { message: 'คำอธิบายสินค้าห้ามเกิน 1000 ตัวอักษร' })
    .optional()
    .or(z.literal('')),
  price: z
    .string()
    .min(1, { message: 'กรุณากรอกราคาสินค้า' })
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
      message: 'ราคาสินค้าต้องเป็นตัวเลขเชิงบวกตั้งแต่ 0 ขึ้นไป',
    }),
});

export type ServiceInput = z.infer<typeof serviceSchema>;
