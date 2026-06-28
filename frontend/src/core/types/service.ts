// src/core/types/service.ts

export interface Service {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  priceMinor: string; // เก็บเป็นหน่วยสตางค์ (สตริงหรือบิ๊กอินต์)
  currency: string;   // 'THB'
  imageFileId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  image?: {
    id: string;
    publicUrl: string;
  } | null;
}
