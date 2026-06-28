import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export type FileKind = 'logo' | 'service_image' | 'post_media';

@Entity('files')
@Index(['ownerId'])
@Index(['kind', 'createdAt'])
export class File {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @Column({ type: 'text' })
  kind: FileKind;

  @Column({ name: 'storage_key', type: 'text' })
  storageKey: string;

  @Column({ type: 'text' })
  mime: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes: number;

  @Column({ name: 'public_url', type: 'text' })
  publicUrl: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date | null;

  @ManyToOne(() => User, (user) => user.files)
  @JoinColumn({ name: 'owner_id' })
  owner: User;
}
