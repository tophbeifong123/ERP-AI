import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Business } from './business.entity';
import { FacebookPage } from './facebook-page.entity';
import { PostMedia } from './post-media.entity';
import { AiJob } from './ai-job.entity';

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
export type GenerationSource = 'auto_ai' | 'fixed_schedule' | 'manual';
export type RejectionReason = 'user_rejected' | 'timeout';

@Entity('posts')
@Index(['businessId', 'status', 'createdAt'])
@Index(['status', 'scheduledAt'], { where: "status = 'approved'" })
@Index(['status', 'scheduledAt'], { where: "status = 'pending_approval'" })
@Index(['businessId', 'postedAt'], { where: "status = 'posted'" })
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @Column({ name: 'fb_page_id', type: 'uuid', nullable: true })
  fbPageId: string | null;

  @Column({ type: 'text', nullable: true })
  caption: string | null;

  @Column({ type: 'text', default: 'draft' })
  status: PostStatus;

  @Column({ name: 'post_type', type: 'text', nullable: true })
  postType: PostType | null;

  @Column({ name: 'generation_source', type: 'text' })
  generationSource: GenerationSource;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'approval_deadline', type: 'timestamptz', nullable: true })
  approvalDeadline: Date | null;

  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt: Date | null;

  @Column({ name: 'fb_post_id', type: 'text', nullable: true })
  fbPostId: string | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: RejectionReason | null;

  @Column({ name: 'error_code', type: 'text', nullable: true })
  errorCode: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date | null;

  @ManyToOne(() => Business, (business) => business.posts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => FacebookPage, { nullable: true })
  @JoinColumn({ name: 'fb_page_id' })
  fbPage: FacebookPage | null;

  @OneToMany(() => PostMedia, (media) => media.post)
  media: PostMedia[];

  @OneToMany(() => AiJob, (job) => job.post)
  aiJobs: AiJob[];
}
