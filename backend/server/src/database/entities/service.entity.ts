import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Business } from './business.entity';
import { File } from './file.entity';

@Entity('services')
@Index(['businessId'], { where: 'deleted_at IS NULL AND is_active = true' })
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'price_minor', type: 'bigint' })
  priceMinor: number;

  @Column({ type: 'char', length: 3, default: 'THB' })
  currency: string;

  @Column({ name: 'image_file_id', type: 'uuid', nullable: true })
  imageFileId: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date | null;

  @ManyToOne(() => Business, (business) => business.services, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => File, { nullable: true })
  @JoinColumn({ name: 'image_file_id' })
  image: File | null;
}
