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
import { Post } from './post.entity';

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

  @OneToMany(() => Post, (post) => post.business)
  posts: Post[];
}
