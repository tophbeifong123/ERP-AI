import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { S3Service } from '../files/s3.service';

export interface HealthCheckResult {
  status: 'ok' | 'degraded';
  db: 'ok' | 'error';
  redis: 'ok' | 'error';
  storage: 'ok' | 'error';
  version: string;
  uptime: number;
  errors?: Record<string, string>;
}

@Injectable()
export class HealthService {
  private startTime = Date.now();

  constructor(
    private dataSource: DataSource,
    private redis: Redis,
    private s3Service: S3Service,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const result: HealthCheckResult = {
      status: 'ok',
      db: 'ok',
      redis: 'ok',
      storage: 'ok',
      version: '1.0.0',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };

    const errors: Record<string, string> = {};

    const [dbResult, redisResult, storageResult] = await Promise.allSettled([
      this.checkDb(),
      this.checkRedis(),
      this.checkStorage(),
    ]);

    if (dbResult.status === 'rejected') {
      result.db = 'error';
      errors.db = dbResult.reason?.message || 'Unknown error';
    }

    if (redisResult.status === 'rejected') {
      result.redis = 'error';
      errors.redis = redisResult.reason?.message || 'Unknown error';
    }

    if (storageResult.status === 'rejected') {
      result.storage = 'error';
      errors.storage = storageResult.reason?.message || 'Unknown error';
    }

    if (Object.keys(errors).length > 0) {
      result.status = 'degraded';
      result.errors = errors;
    }

    return result;
  }

  private async checkDb(): Promise<void> {
    await this.dataSource.query('SELECT 1');
  }

  private async checkRedis(): Promise<void> {
    await this.redis.ping();
  }

  private async checkStorage(): Promise<void> {
    const isOk = await this.s3Service.ping();
    if (!isOk) {
      throw new Error('Storage unavailable');
    }
  }
}
