// src/core/types/business.ts

export type Tone = 'friendly' | 'professional' | 'playful' | 'luxurious' | 'minimal';

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
  logoFileId: string | null;
  createdAt: string;
  updatedAt: string;
  logo?: {
    id: string;
    publicUrl: string;
  } | null;
  facebookPages?: FacebookPageRelation[];
}
