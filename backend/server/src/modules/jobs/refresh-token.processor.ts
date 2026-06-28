import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { RefreshToken } from '../../database/entities/refresh-token.entity';

export interface RefreshTokenJobData {
  olderThanDays?: number;
}

@Processor('refresh-token-cleanup')
export class RefreshTokenProcessor extends WorkerHost {
  private readonly logger = new Logger(RefreshTokenProcessor.name);

  constructor(
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
  ) {
    super();
  }

  async process(job: Job<RefreshTokenJobData>): Promise<{ deleted: number }> {
    const days = job.data?.olderThanDays ?? 30;
    const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
    const result = await this.refreshTokenRepo.delete({
      expiresAt: LessThan(cutoff),
    });
    const deleted = result.affected ?? 0;
    this.logger.log(
      `Refresh-token cleanup: deleted ${deleted} tokens older than ${days} days`,
    );
    return { deleted };
  }
}
