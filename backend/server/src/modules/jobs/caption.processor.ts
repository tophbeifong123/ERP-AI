import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AiJob } from '../../database/entities/ai-job.entity';
import { Post, PostType } from '../../database/entities/post.entity';
import { Business } from '../../database/entities/business.entity';
import { Service } from '../../database/entities/service.entity';
import { PostFeaturedService } from '../../database/entities/post-featured-service.entity';
import { File } from '../../database/entities/file.entity';

export interface CaptionJobData {
  jobId: string;
}

const VALID_POST_TYPES: PostType[] = [
  'promotion',
  'product_showcase',
  'brand_awareness',
  'event',
];

@Processor('caption')
export class CaptionProcessor extends WorkerHost {
  private readonly logger = new Logger(CaptionProcessor.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(AiJob) private jobRepo: Repository<AiJob>,
    @InjectRepository(Post) private postRepo: Repository<Post>,
    @InjectRepository(Business) private businessRepo: Repository<Business>,
    @InjectRepository(Service) private serviceRepo: Repository<Service>,
    @InjectRepository(PostFeaturedService) private featuredRepo: Repository<PostFeaturedService>,
    @InjectRepository(File) private fileRepo: Repository<File>,
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

    const business = await this.businessRepo.findOne({
      where: { id: post.businessId, deletedAt: IsNull() },
    });
    if (!business) {
      throw new Error(`Business ${post.businessId} not found for caption job ${jobId}`);
    }

    const postType: PostType =
      post.postType && VALID_POST_TYPES.includes(post.postType) ? post.postType : 'promotion';
    if (post.postType && !VALID_POST_TYPES.includes(post.postType)) {
      this.logger.warn(
        `Post ${post.id} has unknown postType=${post.postType}, defaulting to 'promotion'`,
      );
    }

    const featuredRows = await this.featuredRepo.find({ where: { postId: post.id } });
    const featuredIds = featuredRows.map((r) => r.serviceId);
    const services = featuredIds.length
      ? await this.serviceRepo.find({ where: { id: In(featuredIds), deletedAt: IsNull() } })
      : [];
    const featuredServices = services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      price: Number(s.priceMinor),
      currency: s.currency,
    }));

    let logoPublicUrl: string | null = null;
    if (business.logoFileId) {
      const logo = await this.fileRepo.findOne({ where: { id: business.logoFileId } });
      logoPublicUrl = logo?.publicUrl ?? null;
    }

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
        logoPublicUrl,
      },
      postType,
      featuredServices,
      captionHint:
        (aiJob.payload?.captionHint as string | undefined) ??
        (aiJob.payload?.suggested_caption_hint as string | undefined) ??
        null,
      targetAudience: business.targetAudience,
    };

    try {
      const res = await fetch(`${aiCaptionUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': internalKey ?? '',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`AI caption service returned ${res.status}: ${text.slice(0, 300)}`);
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
