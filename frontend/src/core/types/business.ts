// src/core/types/business.ts

export type Tone = 'friendly' | 'professional' | 'playful' | 'luxurious' | 'minimal';
export type AutoPostMode = 'ai_decide' | 'fixed_schedule';

export interface FixedScheduleRule {
  dayOfWeek: number; // 0-6 (0=Sunday)
  time: string;      // HH:mm format
}

export interface AutoPostConfig {
  enabled: boolean;
  mode: AutoPostMode;
  postsPerWeekTarget: number;
  minGapDays: number;
  fixedScheduleRules: FixedScheduleRule[];
}

export interface FacebookPageRelation {
  id: string;
  businessId: string;
  fbPageId: string;
  pageName: string;
  pictureUrl: string | null;
  tokenExpiresAt: string;
  scopes: string[];
}

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  industry: string;
  description: string | null;
  targetAudience: string | null;
  tone: Tone | null;
  keywords: string[];
  autoPostEnabled: boolean;
  autoPostMode: AutoPostMode | null;
  postsPerWeekTarget: number;
  minGapDays: number;
  fixedScheduleRules: FixedScheduleRule[];
  logoFileId: string | null;
  createdAt: string;
  updatedAt: string;
  logo?: {
    id: string;
    publicUrl: string;
  } | null;
  facebookPages?: FacebookPageRelation[];
}
