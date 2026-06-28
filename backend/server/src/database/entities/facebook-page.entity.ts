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

@Entity('facebook_pages')
@Index(['businessId', 'fbPageId'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Index(['tokenExpiresAt'])
export class FacebookPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @Column({ name: 'fb_page_id', type: 'text' })
  fbPageId: string;

  @Column({ name: 'page_name', type: 'text' })
  pageName: string;

  @Column({ name: 'picture_url', type: 'text', nullable: true })
  pictureUrl: string | null;

  @Column({ name: 'access_token_encrypted', type: 'bytea' })
  accessTokenEncrypted: Buffer;

  @Column({ name: 'token_expires_at', type: 'timestamptz' })
  tokenExpiresAt: Date;

  @Column({ type: 'text', array: true, default: '{}' })
  scopes: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date | null;

  @ManyToOne(() => Business, (business) => business.facebookPages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'business_id' })
  business: Business;
}
