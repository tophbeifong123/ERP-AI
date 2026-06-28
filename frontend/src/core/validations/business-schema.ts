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

/**
 * Schema สำหรับตั้งเวลาและโหมดโพสต์อัตโนมัติ (Step 2)
 */
export const fixedScheduleRuleSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'รูปแบบเวลาต้องเป็น HH:mm' }),
});

export const autoPostConfigSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['ai_decide', 'fixed_schedule']),
  postsPerWeekTarget: z
    .number()
    .int()
    .min(1, { message: 'เป้าหมายการโพสต์ต้องไม่ต่ำกว่า 1 โพสต์/สัปดาห์' })
    .max(14, { message: 'เป้าหมายการโพสต์สูงสุดคือ 14 โพสต์/สัปดาห์' }),
  minGapDays: z
    .number()
    .int()
    .min(0, { message: 'ระยะห่างห้ามต่ำกว่า 0 วัน' })
    .max(7, { message: 'ระยะห่างห้ามเกิน 7 วัน' }),
  fixedScheduleRules: z.array(fixedScheduleRuleSchema),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type AutoPostConfigInput = z.infer<typeof autoPostConfigSchema>;
export type FixedScheduleRuleInput = z.infer<typeof fixedScheduleRuleSchema>;
