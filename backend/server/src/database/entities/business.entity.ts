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
import { User } from './user.entity';
import { File } from './file.entity';
import { Service } from './service.entity';
import { FacebookPage } from './facebook-page.entity';
import { ContentPlan } from './content-plan.entity';
import { Post } from './post.entity';

export type AutoPostMode = 'ai_decide' | 'fixed_schedule';

export interface FixedScheduleRule {
  dayOfWeek: number;
  time: string;
}

@Entity('businesses')
@Index(['ownerId'], { where: 'deleted_at IS NULL' })
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  industry: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'target_audience', type: 'text', nullable: true })
  targetAudience: string | null;

  @Column({ type: 'text', nullable: true })
  tone: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  keywords: string[];

  @Column({ name: 'auto_post_enabled', type: 'boolean', default: false })
  autoPostEnabled: boolean;

  @Column({ name: 'auto_post_mode', type: 'text', nullable: true })
  autoPostMode: AutoPostMode | null;

  @Column({ name: 'posts_per_week_target', type: 'smallint', default: 3 })
  postsPerWeekTarget: number;

  @Column({ name: 'min_gap_days', type: 'smallint', default: 1 })
  minGapDays: number;

  @Column({ name: 'fixed_schedule_rules', type: 'jsonb', default: [] })
  fixedScheduleRules: FixedScheduleRule[];

  @Column({ name: 'logo_file_id', type: 'uuid', nullable: true })
  logoFileId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date | null;

  @ManyToOne(() => User, (user) => user.businesses)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @ManyToOne(() => File, { nullable: true })
  @JoinColumn({ name: 'logo_file_id' })
  logo: File | null;

  @OneToMany(() => Service, (service) => service.business)
  services: Service[];

  @OneToMany(() => FacebookPage, (page) => page.business)
  facebookPages: FacebookPage[];

  @OneToMany(() => ContentPlan, (plan) => plan.business)
  contentPlans: ContentPlan[];

  @OneToMany(() => Post, (post) => post.business)
  posts: Post[];
}
