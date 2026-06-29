import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AiJob } from '../../database/entities/ai-job.entity';
import { Post } from '../../database/entities/post.entity';
import { Business } from '../../database/entities/business.entity';
import { Service } from '../../database/entities/service.entity';
import { PostFeaturedService } from '../../database/entities/post-featured-service.entity';

export interface DecisionJobData {
  jobId: string;
}

@Processor('decision')
export class DecisionProcessor extends WorkerHost {
  private readonly logger = new Logger(DecisionProcessor.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(AiJob) private jobRepo: Repository<AiJob>,
    @InjectRepository(Post) private postRepo: Repository<Post>,
    @InjectRepository(Business) private businessRepo: Repository<Business>,
    @InjectRepository(Service) private serviceRepo: Repository<Service>,
    @InjectRepository(PostFeaturedService)
    private featuredRepo: Repository<PostFeaturedService>,
  ) {
    super();
  }

  async process(
    job: Job<DecisionJobData>,
  ): Promise<{ status: string }> {
    const { jobId } = job.data;
    const aiJob = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!aiJob) {
      this.logger.warn(`Decision job ${jobId} not found, skipping`);
      return { status: 'skipped' };
    }
    if (aiJob.status === 'succeeded') {
      return { status: 'already_succeeded' };
    }

    const post = await this.postRepo.findOne({ where: { id: aiJob.postId } });
    if (!post) {
      throw new Error(`Post ${aiJob.postId} not found`);
    }

    aiJob.status = 'running';
    aiJob.attempts += 1;
    await this.jobRepo.save(aiJob);

    const aiDecisionUrl = this.configService.get<string>('app.ai.decisionUrl');
    const internalKey = this.configService.get<string>('app.internalApiKey');
    const callbackUrl = `${this.configService.get<string>('app.appUrl')}/internal/ai/decision/callback`;

    const business = await this.businessRepo.findOne({
      where: { id: post.businessId, deletedAt: IsNull() },
    });
    if (!business) {
      throw new Error(
        `Business ${post.businessId} not found for decision job ${jobId}`,
      );
    }

    const featuredRows = await this.featuredRepo.find({
      where: { postId: post.id },
    });
    const featuredIds = featuredRows.map((r) => r.serviceId);
    const services = featuredIds.length
      ? await this.serviceRepo.find({
          where: { id: In(featuredIds), deletedAt: IsNull() },
        })
      : [];
    const featuredServices = services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      priceMinor: Number(s.priceMinor),
      currency: s.currency,
    }));

    const hint =
      (aiJob.payload?.hint as string | undefined) ??
      (aiJob.payload?.captionHint as string | undefined) ??
      null;

    const payload = {
      callbackUrl,
      jobId: aiJob.id,
      postId: post.id,
      business: {
        id: business.id,
        name: business.name,
        industry: business.industry,
        tone: business.tone,
        keywords: business.keywords ?? [],
        targetAudience: business.targetAudience,
      },
      postType: post.postType ?? null,
      featuredServices,
      captionHint: hint,
      nowIso: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${aiDecisionUrl}/recommend-time`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': internalKey ?? '',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(
          `AI decision service returned ${res.status}: ${text.slice(0, 300)}`,
        );
      }

      this.logger.log(
        `Decision job ${jobId} dispatched to AI service for post ${post.id}`,
      );
      return { status: 'dispatched' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Decision job ${jobId} dispatch failed: ${message}`);
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
