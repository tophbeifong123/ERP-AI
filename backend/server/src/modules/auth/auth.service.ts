import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User } from '../../database/entities/user.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { EmailVerification } from '../../database/entities/email-verification.entity';
import { PasswordReset } from '../../database/entities/password-reset.entity';
import { randomToken, sha256 } from '../../common/crypto/hash.util';
import { TokenService } from './token.service';
import { EmailService } from '../email/email.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: { id: string; email: string; emailVerifiedAt: Date | null };
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(RefreshToken) private refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(EmailVerification) private emailVerificationRepo: Repository<EmailVerification>,
    @InjectRepository(PasswordReset) private passwordResetRepo: Repository<PasswordReset>,
    private tokenService: TokenService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async register(email: string, password: string, meta?: { userAgent?: string; ip?: string }): Promise<{ user: { id: string; email: string } }> {
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing && !existing.deletedAt) {
      throw new ConflictException({ message: 'Email already registered', error: 'email_taken' });
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    let user: User;
    if (existing && existing.deletedAt) {
      existing.passwordHash = passwordHash;
      existing.deletedAt = null;
      existing.emailVerifiedAt = null;
      user = await this.userRepo.save(existing);
    } else {
      user = await this.userRepo.save(this.userRepo.create({ email, passwordHash }));
    }

    const token = randomToken();
    const tokenHash = sha256(token);
    await this.emailVerificationRepo.save(
      this.emailVerificationRepo.create({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      }),
    );
    await this.emailService.enqueueVerifyEmail(user.id, user.email, token);

    return { user: { id: user.id, email: user.email } };
  }

  async login(
    email: string,
    password: string,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<AuthResult> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException({ message: 'Invalid credentials', error: 'invalid_credentials' });
    }

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      throw new UnauthorizedException({ message: 'Invalid credentials', error: 'invalid_credentials' });
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({ message: 'Email not verified', error: 'email_not_verified' });
    }

    const tokens = await this.issueTokens(user, meta);
    return {
      user: { id: user.id, email: user.email, emailVerifiedAt: user.emailVerifiedAt },
      ...tokens,
    };
  }

  async refresh(
    refreshToken: string,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<AuthTokens> {
    let payload;
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException({ message: 'Invalid or expired refresh token', error: 'invalid_token' });
    }

    const tokenHash = sha256(refreshToken);
    const stored = await this.refreshTokenRepo.findOne({ where: { tokenHash } });
    if (!stored || stored.userId !== payload.sub) {
      throw new UnauthorizedException({ message: 'Invalid refresh token', error: 'invalid_token' });
    }
    if (stored.revokedAt) {
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId}, revoking chain`);
      await this.refreshTokenRepo
        .createQueryBuilder()
        .update(RefreshToken)
        .set({ revokedAt: new Date() })
        .where('user_id = :uid AND revoked_at IS NULL', { uid: stored.userId })
        .execute();
      throw new UnauthorizedException({ message: 'Refresh token reuse detected', error: 'invalid_token' });
    }

    const user = await this.userRepo.findOne({ where: { id: stored.userId } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException({ message: 'User not found', error: 'invalid_token' });
    }

    const newTokens = await this.issueTokens(user, meta);
    await this.refreshTokenRepo.update(stored.id, { revokedAt: new Date() });
    return newTokens;
  }

  async logout(refreshToken: string): Promise<void> {
    if (!refreshToken) return;
    const tokenHash = sha256(refreshToken);
    const stored = await this.refreshTokenRepo.findOne({ where: { tokenHash } });
    if (stored && !stored.revokedAt) {
      await this.refreshTokenRepo.update(stored.id, { revokedAt: new Date() });
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user || user.deletedAt) {
      return;
    }
    const token = randomToken();
    const tokenHash = sha256(token);
    await this.passwordResetRepo.save(
      this.passwordResetRepo.create({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      }),
    );
    await this.emailService.enqueueResetPassword(user.id, user.email, token);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = sha256(token);
    const record = await this.passwordResetRepo.findOne({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException({
        message: 'Invalid or expired reset token',
        error: 'invalid_or_expired_token',
      });
    }

    const user = await this.userRepo.findOne({ where: { id: record.userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ message: 'User not found', error: 'not_found' });
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
    user.passwordHash = passwordHash;
    await this.userRepo.save(user);
    await this.passwordResetRepo.update(record.id, { usedAt: new Date() });

    await this.refreshTokenRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('user_id = :uid AND revoked_at IS NULL', { uid: user.id })
      .execute();
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = sha256(token);
    const record = await this.emailVerificationRepo.findOne({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException({
        message: 'Invalid or expired verification token',
        error: 'invalid_or_expired_token',
      });
    }
    await this.userRepo.update(record.userId, { emailVerifiedAt: new Date() });
    await this.emailVerificationRepo.update(record.id, { usedAt: new Date() });
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    currentRefreshToken?: string,
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ message: 'User not found', error: 'not_found' });
    }
    const ok = await argon2.verify(user.passwordHash, oldPassword);
    if (!ok) {
      throw new UnauthorizedException({ message: 'Invalid current password', error: 'invalid_credentials' });
    }
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
    user.passwordHash = passwordHash;
    await this.userRepo.save(user);

    const currentHash = currentRefreshToken ? sha256(currentRefreshToken) : null;
    await this.refreshTokenRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('user_id = :uid AND revoked_at IS NULL AND token_hash != :hash', {
        uid: userId,
        hash: currentHash ?? '__none__',
      })
      .execute();
  }

  private async issueTokens(
    user: User,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<AuthTokens> {
    const jti = randomToken(16);
    const accessToken = this.tokenService.signAccessToken({ id: user.id, email: user.email });
    const refreshToken = this.tokenService.signRefreshToken({ id: user.id, email: user.email }, jti);
    const refreshTokenHash = sha256(refreshToken);

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + this.tokenService.refreshTtlSeconds * 1000),
        userAgent: meta?.userAgent ?? null,
        ip: meta?.ip ?? null,
      }),
    );
    return { accessToken, refreshToken };
  }
}
