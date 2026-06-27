import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiJob } from '../../database/entities/ai-job.entity';
import { Post } from '../../database/entities/post.entity';

export interface MediaJobData {
  jobId: string;
}

@Processor('media')
export class MediaProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaProcessor.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(AiJob) private jobRepo: Repository<AiJob>,
    @InjectRepository(Post) private postRepo: Repository<Post>,
  ) {
    super();
  }

  async process(job: Job<MediaJobData>): Promise<{ fileId: string }> {
    const { jobId } = job.data;
    const aiJob = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!aiJob) {
      this.logger.warn(`Media job ${jobId} not found, skipping`);
      return { fileId: '' };
    }
    if (aiJob.status === 'succeeded') {
      return { fileId: (aiJob.result?.fileId as string) ?? '' };
    }

    const post = await this.postRepo.findOne({ where: { id: aiJob.postId } });
    if (!post) {
      throw new Error(`Post ${aiJob.postId} not found`);
    }

    aiJob.status = 'running';
    aiJob.attempts += 1;
    await this.jobRepo.save(aiJob);

    const aiMediaUrl = this.configService.get<string>('app.ai.mediaUrl');
    const internalKey = this.configService.get<string>('app.internalApiKey');
    const callbackUrl = `${this.configService.get<string>('app.appUrl')}/internal/ai/${aiJob.type === 'short_video' ? 'short_video' : 'image'}/callback`;

    try {
      const res = await fetch(`${aiMediaUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': internalKey ?? '',
        },
        body: JSON.stringify({
          jobId: aiJob.id,
          postId: post.id,
          type: aiJob.type,
          postType: post.postType,
          callbackUrl,
        }),
      });

      if (!res.ok) {
        throw new Error(`AI media service returned ${res.status}`);
      }

      const data = (await res.json()) as { fileId?: string };
      if (!data.fileId) {
        throw new Error('AI media service did not return fileId');
      }

      aiJob.status = 'succeeded';
      aiJob.result = { fileId: data.fileId };
      await this.jobRepo.save(aiJob);
      this.logger.log(`Media job ${jobId} succeeded (fileId=${data.fileId})`);
      return { fileId: data.fileId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Media job ${jobId} failed: ${message}`);
      if (aiJob.attempts >= aiJob.maxAttempts) {
        aiJob.status = 'failed';
        aiJob.lastError = message;
      } else {
        aiJob.status = 'queued';
        aiJob.nextRunAt = new Date(Date.now() + 60_000);
        aiJob.lastError = message;
      }
      await this.jobRepo.save(aiJob);
      throw err;
    }
  }
}
