import {
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private key: Buffer;

  constructor(private configService: ConfigService) {}

  onModuleInit(): void {
    const raw = this.configService.get<string>('app.fbTokenEncryptionKey');
    if (!raw) {
      throw new InternalServerErrorException(
        'FB_TOKEN_ENCRYPTION_KEY is not set in environment',
      );
    }
    this.key = Buffer.from(raw, 'base64');
    if (this.key.length !== 32) {
      throw new InternalServerErrorException(
        `FB_TOKEN_ENCRYPTION_KEY must decode to 32 bytes (got ${this.key.length})`,
      );
    }
    this.logger.log(
      'EncryptionService initialised with 32-byte AES-256-GCM key',
    );
  }

  encrypt(plaintext: string): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, ciphertext]);
  }

  decrypt(payload: Buffer): string {
    if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new InternalServerErrorException('Encrypted payload too short');
    }
    const iv = payload.subarray(0, IV_LENGTH);
    const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }
}
