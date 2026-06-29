// src/core/types/post.ts

export type PostStatus =
  | 'draft'
  | 'generating'
  | 'pending_approval'
  | 'approved'
  | 'posted'
  | 'rejected'
  | 'expired'
  | 'failed';

export type PostType =
  | 'promotion'
  | 'product_showcase'
  | 'brand_awareness'
  | 'event';

export type GenerationSource = 'manual';
export type RejectionReason = 'user_rejected' | 'timeout';
export type PostMediaKind = 'image' | 'short_video';
export type PostMediaType = 'image' | 'short_video';

export interface PostFile {
  id: string;
  publicUrl: string;
  mimeType: string;
  originalName: string;
}

export interface PostMedia {
  id: string;
  postId: string;
  fileId: string;
  kind: PostMediaKind;
  orderIndex: number;
  createdAt: string;
  file: PostFile;
}

export interface Post {
  id: string;
  businessId: string;
  fbPageId: string | null;
  caption: string | null;
  status: PostStatus;
  postType: PostType | null;
  mediaType: PostMediaType;
  generationSource: GenerationSource;
  scheduledAt: string | null;
  suggestedScheduledAt: string | null;
  approvalDeadline: string | null;
  postedAt: string | null;
  fbPostId: string | null;
  rejectionReason: RejectionReason | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  media?: PostMedia[];
}

export interface CreatedJobs {
  captionJobId: string;
  mediaJobId: string | null;
  decisionJobId: string;
}
