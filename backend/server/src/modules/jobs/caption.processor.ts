import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiJob } from '../../database/entities/ai-job.entity';
import { Post } from '../../database/entities/post.entity';

export interface CaptionJobData {
  jobId: string;
}

@Processor('caption')
export class CaptionProcessor extends WorkerHost {
  private readonly logger = new Logger(CaptionProcessor.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(AiJob) private jobRepo: Repository<AiJob>,
    @InjectRepository(Post) private postRepo: Repository<Post>,
  ) {
    super();
  }

  async process(job: Job<CaptionJobData>): Promise<{ caption: string }> {
    const { jobId } = job.data;
    const aiJob = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!aiJob) {
      this.logger.warn(`Caption job ${jobId} not found, skipping`);
      return { caption: '' };
    }
    if (aiJob.status === 'succeeded') {
      return { caption: (aiJob.result?.caption as string) ?? '' };
    }

    const post = await this.postRepo.findOne({ where: { id: aiJob.postId } });
    if (!post) {
      throw new Error(`Post ${aiJob.postId} not found`);
    }

    aiJob.status = 'running';
    aiJob.attempts += 1;
    await this.jobRepo.save(aiJob);

    const aiCaptionUrl = this.configService.get<string>('app.ai.captionUrl');
    const internalKey = this.configService.get<string>('app.internalApiKey');
    const callbackUrl = `${this.configService.get<string>('app.appUrl')}/internal/ai/caption/callback`;

    try {
      const res = await fetch(`${aiCaptionUrl}/caption`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': internalKey ?? '',
        },
        body: JSON.stringify({
          jobId: aiJob.id,
          postId: post.id,
          businessId: post.businessId,
          postType: post.postType,
          captionHint: post.caption ?? aiJob.payload?.captionHint ?? null,
          callbackUrl,
        }),
      });

      if (!res.ok) {
        throw new Error(`AI caption service returned ${res.status}`);
      }

      const data = (await res.json()) as { caption?: string };
      if (!data.caption) {
        throw new Error('AI caption service did not return caption');
      }

      const updatedPost = await this.postRepo.findOne({
        where: { id: post.id },
      });
      if (updatedPost) {
        updatedPost.caption = data.caption;
        if (updatedPost.status === 'draft') {
          updatedPost.status = 'pending_approval';
        }
        await this.postRepo.save(updatedPost);
      }

      aiJob.status = 'succeeded';
      aiJob.result = { caption: data.caption };
      await this.jobRepo.save(aiJob);
      this.logger.log(`Caption job ${jobId} succeeded for post ${post.id}`);
      return { caption: data.caption };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Caption job ${jobId} failed: ${message}`);
      if (aiJob.attempts >= aiJob.maxAttempts) {
        aiJob.status = 'failed';
        aiJob.lastError = message;
      } else {
        aiJob.status = 'queued';
        aiJob.nextRunAt = new Date(Date.now() + 30_000);
        aiJob.lastError = message;
      }
      await this.jobRepo.save(aiJob);
      throw err;
    }
  }
}
