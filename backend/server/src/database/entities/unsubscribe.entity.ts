import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export type UnsubscribeCategory = 'marketing' | 'transactional';

@Entity('unsubscribes')
export class Unsubscribe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'text', unique: true })
  token: string;

  @Column({ type: 'text' })
  category: UnsubscribeCategory;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.unsubscribes)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
