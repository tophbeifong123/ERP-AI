import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Business } from './business.entity';
import { RefreshToken } from './refresh-token.entity';
import { EmailVerification } from './email-verification.entity';
import { PasswordReset } from './password-reset.entity';
import { File } from './file.entity';
import { Notification } from './notification.entity';
import { EmailLog } from './email-log.entity';
import { Unsubscribe } from './unsubscribe.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'citext', unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date | null;

  @OneToMany(() => Business, (business) => business.owner)
  businesses: Business[];

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];

  @OneToMany(() => EmailVerification, (verification) => verification.user)
  emailVerifications: EmailVerification[];

  @OneToMany(() => PasswordReset, (reset) => reset.user)
  passwordResets: PasswordReset[];

  @OneToMany(() => File, (file) => file.owner)
  files: File[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  @OneToMany(() => EmailLog, (log) => log.user)
  emailLogs: EmailLog[];

  @OneToMany(() => Unsubscribe, (unsub) => unsub.user)
  unsubscribes: Unsubscribe[];
}
