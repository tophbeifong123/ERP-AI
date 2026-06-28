import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Business } from './business.entity';
import { Post } from './post.entity';

export type ContentPlanStatus =
  | 'pending_decide'
  | 'planned'
  | 'materialized'
  | 'cancelled';
export type DecidedBy = 'ai' | 'user';

@Entity('content_plans')
export class ContentPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @Column({ name: 'decided_by', type: 'text' })
  decidedBy: DecidedBy;

  @Column({ name: 'should_post_today', type: 'boolean', default: true })
  shouldPostToday: boolean;

  @Column({ type: 'text', default: 'planned' })
  status: ContentPlanStatus;

  @Column({ name: 'ai_reasoning', type: 'text', nullable: true })
  aiReasoning: string | null;

  @Column({ name: 'suggested_post_type', type: 'text', nullable: true })
  suggestedPostType: string | null;

  @Column({
    name: 'suggested_featured_service_ids',
    type: 'uuid',
    array: true,
    default: '{}',
  })
  suggestedFeaturedServiceIds: string[];

  @Column({ name: 'suggested_caption_hint', type: 'text', nullable: true })
  suggestedCaptionHint: string | null;

  @Column({
    name: 'suggested_scheduled_at',
    type: 'timestamptz',
    nullable: true,
  })
  suggestedScheduledAt: Date | null;

  @Column({ name: 'target_window_start', type: 'timestamptz', nullable: true })
  targetWindowStart: Date | null;

  @Column({ name: 'target_window_end', type: 'timestamptz', nullable: true })
  targetWindowEnd: Date | null;

  @Column({ name: 'payload_json', type: 'jsonb', default: {} })
  payloadJson: Record<string, unknown>;

  @Column({ name: 'materialized_post_id', type: 'uuid', nullable: true })
  materializedPostId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Business, (business) => business.contentPlans, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => Post, { nullable: true })
  @JoinColumn({ name: 'materialized_post_id' })
  materializedPost: Post | null;
}
