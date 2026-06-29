import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

export interface PresignedUploadResult {
  presignedUrl: string;
  storageKey: string;
  publicUrl: string;
  expiresAt: Date;
}

export interface UploadResult {
  storageKey: string;
  publicUrl: string;
  sizeBytes: number;
  mime: string;
}

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private client: S3Client;
  private presignClient: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('s3.endpoint');
    const region = this.configService.get<string>('s3.region');
    const accessKey = this.configService.get<string>('s3.accessKey');
    const secretKey = this.configService.get<string>('s3.secretKey');

    this.bucket = this.configService.get<string>('s3.bucket') || 'erp-ai';
    this.publicUrl =
      this.configService.get<string>('s3.publicUrl') ||
      `${endpoint}/${this.bucket}`;

    const baseCreds = {
      accessKeyId: accessKey || '',
      secretAccessKey: secretKey || '',
    };

    // Client for backend's own operations (uploads, downloads) — uses
    // whatever host the backend uses to reach MinIO (usually localhost).
    this.client = new S3Client({
      endpoint,
      region,
      credentials: baseCreds,
      forcePathStyle: true,
    });

    // Client for presigned URLs that will be handed to EXTERNAL callers
    // (e.g. n8n container). The host inside the presigned URL must be
    // reachable by those callers. In docker-compose, MinIO is reachable
    // as `minio:9000` from other containers but the backend (running on
    // the host) reaches it as `localhost:9000`.
    const presignEndpoint =
      this.configService.get<string>('s3.presignEndpoint') ||
      this.configService.get<string>('s3.endpoint');
    this.presignClient = new S3Client({
      endpoint: presignEndpoint,
      region,
      credentials: baseCreds,
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    await this.ensureBucketExists();
  }

  private async ensureBucketExists() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket "${this.bucket}" exists`);
    } catch {
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        this.logger.log(`Created bucket "${this.bucket}"`);
      } catch (err) {
        this.logger.warn(`Could not create bucket: ${err}`);
      }
    }
  }

  async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return {
      storageKey: key,
      publicUrl: `${this.publicUrl}/${key}`,
      sizeBytes: buffer.length,
      mime: contentType,
    };
  }

  async generatePresignedUploadUrl(
    prefix: string,
    contentType: string,
    expiresIn = 300,
  ): Promise<PresignedUploadResult> {
    const ext = this.getExtension(contentType);
    const date = new Date();
    const datePath = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    const storageKey = `${prefix}/${datePath}/${uuidv4()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: contentType,
    });

    // Use the presignClient so the URL host is reachable by external
    // callers (e.g. n8n container reaching MinIO via docker hostname).
    const presignedUrl = await getSignedUrl(this.presignClient, command, {
      expiresIn,
    });
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return {
      presignedUrl,
      storageKey,
      publicUrl: `${this.publicUrl}/${storageKey}`,
      expiresAt,
    };
  }

  async generatePresignedDownloadUrl(
    key: string,
    expiresIn = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.presignClient, command, { expiresIn });
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }

  private getExtension(contentType: string): string {
    const map: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
    };
    return map[contentType] || '';
  }
}
