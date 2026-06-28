import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, LessThanOrEqual } from 'typeorm';
import {
  AiJob,
  AiJobStatus,
  AiJobType,
} from '../../database/entities/ai-job.entity';

@Injectable()
export class AiJobsService {
  private readonly logger = new Logger(AiJobsService.name);

  constructor(@InjectRepository(AiJob) private jobRepo: Repository<AiJob>) {}

  async list(filter: {
    type?: AiJobType;
    status?: AiJobStatus;
    postId?: string;
  }): Promise<AiJob[]> {
    const qb = this.jobRepo.createQueryBuilder('job');
    if (filter.type) qb.andWhere('job.type = :type', { type: filter.type });
    if (filter.status)
      qb.andWhere('job.status = :status', { status: filter.status });
    if (filter.postId) qb.andWhere('job.postId = :pid', { pid: filter.postId });
    qb.orderBy('job.createdAt', 'DESC');
    return qb.getMany();
  }

  async getOne(id: string): Promise<AiJob> {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException({
        message: 'AI job not found',
        error: 'not_found',
      });
    }
    return job;
  }

  async retry(id: string): Promise<AiJob> {
    const job = await this.getOne(id);
    if (job.status !== 'failed') {
      return job;
    }
    job.status = 'queued';
    job.attempts = 0;
    job.lastError = null;
    job.nextRunAt = new Date();
    return this.jobRepo.save(job);
  }

  async findDueJobs(limit = 50): Promise<AiJob[]> {
    return this.jobRepo.find({
      where: { status: 'queued', nextRunAt: LessThanOrEqual(new Date()) },
      take: limit,
      order: { nextRunAt: 'ASC' },
    });
  }
}
