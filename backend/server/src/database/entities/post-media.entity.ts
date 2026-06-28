import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Post } from './post.entity';
import { File } from './file.entity';

export type PostMediaKind = 'image' | 'short_video';

@Entity('post_media')
@Unique(['postId', 'orderIndex'])
export class PostMedia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @Column({ name: 'file_id', type: 'uuid' })
  fileId: string;

  @Column({ type: 'text' })
  kind: PostMediaKind;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Post, (post) => post.media, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @ManyToOne(() => File)
  @JoinColumn({ name: 'file_id' })
  file: File;
}
