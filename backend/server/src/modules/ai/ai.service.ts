import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Post } from '../../database/entities/post.entity';
import { PostMedia, PostMediaKind } from '../../database/entities/post-media.entity';
import { ContentPlan } from '../../database/entities/content-plan.entity';
import { AiJob } from '../../database/entities/ai-job.entity';
import { Business } from '../../database/entities/business.entity';
import { Service } from '../../database/entities/service.entity';
import { File } from '../../database/entities/file.entity';
import { PostStateMachine } from './state-machine';
import { PostEventsService } from '../posts/post-events.service';

export interface DecideDto {
  planId: string;
  shouldPostToday: boolean;
  reasoning: string;
  suggestedPostType?: string;
  suggestedFeaturedServiceIds?: string[];
  suggestedCaptionHint?: string;
  suggestedScheduledAt?: Date;
  targetWindowStart?: Date;
  targetWindowEnd?: Date;
  payload?: Record<string, unknown>;
}

export interface CaptionDto {
  jobId: string;
  caption: string;
}

export interface MediaCallbackResult {
  storageKey: string;
  publicUrl: string;
  mime?: string | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
}

export interface MediaCallbackDto {
  jobId: string;
  result?: MediaCallbackResult;
  error?: { code: string; message: string };
}

export interface FailDto {
  jobId: string;
  errorCode: string;
  errorMessage: string;
  retryInMs?: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(Post) private postRepo: Repository<Post>,
    @InjectRepository(PostMedia) private postMediaRepo: Repository<PostMedia>,
    @InjectRepository(ContentPlan) private planRepo: Repository<ContentPlan>,
    @InjectRepository(AiJob) private jobRepo: Repository<AiJob>,
    @InjectRepository(Business) private businessRepo: Repository<Business>,
    @InjectRepository(Service) private serviceRepo: Repository<Service>,
    @InjectRepository(File) private fileRepo: Repository<File>,
    @InjectQueue('ai') private aiQueue: Queue,
    private postEvents: PostEventsService,
  ) {}

  async decide(dto: DecideDto): Promise<ContentPlan> {
    const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
    if (!plan) {
      throw new NotFoundException({ message: 'Content plan not found', error: 'not_found' });
    }
    if (plan.status !== 'pending_decide') {
      this.logger.warn(
        `Plan ${plan.id} already has decision (status=${plan.status}), overwriting`,
      );
    }

    plan.decidedBy = 'ai';
    plan.shouldPostToday = dto.shouldPostToday;
    plan.status = 'planned';
    plan.aiReasoning = dto.reasoning;
    plan.suggestedPostType = dto.suggestedPostType ?? null;
    plan.suggestedFeaturedServiceIds = dto.suggestedFeaturedServiceIds ?? [];
    plan.suggestedCaptionHint = dto.suggestedCaptionHint ?? null;
    plan.suggestedScheduledAt = dto.suggestedScheduledAt ?? null;
    plan.targetWindowStart = dto.targetWindowStart ?? null;
    plan.targetWindowEnd = dto.targetWindowEnd ?? null;
    plan.payloadJson = { ...(plan.payloadJson ?? {}), ...(dto.payload ?? {}) };

    return this.planRepo.save(plan);
  }

  async createPendingPlan(businessId: string): Promise<ContentPlan> {
    const business = await this.businessRepo.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });
    if (!business) {
      throw new NotFoundException({ message: 'Business not found', error: 'not_found' });
    }

    const plan = this.planRepo.create({
      businessId,
      decidedBy: 'ai',
      shouldPostToday: true,
      status: 'pending_decide',
      suggestedFeaturedServiceIds: [],
      payloadJson: {},
    });
    return this.planRepo.save(plan);
  }

  async materialize(planId: string): Promise<{ plan: ContentPlan; post: Post }> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException({ message: 'Content plan not found', error: 'not_found' });
    }
    if (plan.status === 'materialized') {
      throw new BadRequestException({ message: 'Plan already materialized', error: 'already_materialized' });
    }
    if (plan.status === 'cancelled') {
      throw new BadRequestException({ message: 'Plan cancelled', error: 'plan_cancelled' });
    }

    const post = this.postRepo.create({
      businessId: plan.businessId,
      fbPageId: null,
      caption: plan.suggestedCaptionHint,
      status: 'draft',
      postType: (plan.suggestedPostType as Post['postType']) ?? null,
      generationSource: 'auto_ai',
      scheduledAt: plan.suggestedScheduledAt ?? null,
      approvalDeadline: plan.suggestedScheduledAt
        ? new Date(plan.suggestedScheduledAt.getTime() + 24 * 3600 * 1000)
        : null,
    });
    const saved = await this.postRepo.save(post);

    plan.status = 'materialized';
    plan.materializedPostId = saved.id;
    await this.planRepo.save(plan);

    return { plan, post: saved };
  }

  async captionCallback(dto: CaptionDto): Promise<Post> {
    const job = await this.jobRepo.findOne({ where: { id: dto.jobId } });
    if (!job) {
      throw new NotFoundException({ message: 'AI job not found', error: 'not_found' });
    }
    if (job.type !== 'caption') {
      throw new BadRequestException({ message: 'Job is not a caption job', error: 'wrong_job_type' });
    }

    const post = await this.postRepo.findOne({ where: { id: job.postId } });
    if (!post) {
      throw new NotFoundException({ message: 'Post not found', error: 'not_found' });
    }

    post.caption = dto.caption;
    PostStateMachine.assertTransition(post.status, 'pending_approval');
    post.status = 'pending_approval';
    const saved = await this.postRepo.save(post);

    job.status = 'succeeded';
    job.result = { caption: dto.caption };
    await this.jobRepo.save(job);

    await this.postEvents.emitForStatus(saved.id, 'pending_approval');

    return saved;
  }

  /**
   * Handle the n8n media callback (image or short_video).
   * On success: create a File row + PostMedia row, mark AiJob succeeded.
   * On error: increment attempts and either re-queue or mark failed.
   */
  async mediaCallback(dto: MediaCallbackDto): Promise<{ job: AiJob; post: Post | null; file?: File; postMedia?: PostMedia }> {
    const job = await this.jobRepo.findOne({ where: { id: dto.jobId } });
    if (!job) {
      throw new NotFoundException({ message: 'AI job not found', error: 'not_found' });
    }
    if (job.type !== 'image' && job.type !== 'short_video') {
      throw new BadRequestException({ message: 'Job is not an image or short_video job', error: 'wrong_job_type' });
    }

    // Error path
    if (dto.error) {
      job.attempts += 1;
      job.lastError = `${dto.error.code}: ${dto.error.message}`;
      if (job.attempts >= job.maxAttempts) {
        job.status = 'failed';
      } else {
        job.status = 'queued';
        job.nextRunAt = new Date(Date.now() + 60_000);
      }
      const saved = await this.jobRepo.save(job);
      return { job: saved, post: null };
    }

    // Success path
    if (!dto.result || !dto.result.storageKey || !dto.result.publicUrl) {
      throw new BadRequestException({ message: 'result.storageKey and result.publicUrl are required', error: 'invalid_payload' });
    }

    const post = await this.postRepo.findOne({ where: { id: job.postId } });
    if (!post) {
      throw new NotFoundException({ message: 'Post not found', error: 'not_found' });
    }
    const business = await this.businessRepo.findOne({
      where: { id: post.businessId, deletedAt: IsNull() },
    });
    if (!business) {
      throw new NotFoundException({ message: 'Business not found', error: 'not_found' });
    }

    const kind: PostMediaKind = job.type === 'short_video' ? 'short_video' : 'image';
    const mime = dto.result.mime || (kind === 'short_video' ? 'video/mp4' : 'image/png');

    // 1) Register a File row so the publicUrl can be resolved via FK
    const file = this.fileRepo.create({
      ownerId: business.ownerId,
      kind: 'post_media',
      storageKey: dto.result.storageKey,
      mime,
      sizeBytes: typeof dto.result.sizeBytes === 'number' ? dto.result.sizeBytes : 0,
      publicUrl: dto.result.publicUrl,
    });
    const savedFile = await this.fileRepo.save(file);

    // 2) Attach as post_media (avoid duplicate row for same job type)
    let postMedia = await this.postMediaRepo.findOne({
      where: { postId: post.id, fileId: savedFile.id },
    });
    if (!postMedia) {
      const existingCount = await this.postMediaRepo.count({ where: { postId: post.id } });
      postMedia = this.postMediaRepo.create({
        postId: post.id,
        fileId: savedFile.id,
        kind,
        orderIndex: existingCount,
      });
      postMedia = await this.postMediaRepo.save(postMedia);
    }

    // 3) Mark job succeeded
    job.status = 'succeeded';
    job.result = {
      fileId: savedFile.id,
      publicUrl: savedFile.publicUrl,
      storageKey: savedFile.storageKey,
      kind,
      width: dto.result.width ?? null,
      height: dto.result.height ?? null,
      durationSec: dto.result.durationSec ?? null,
    };
    const savedJob = await this.jobRepo.save(job);

    return { job: savedJob, post, file: savedFile, postMedia };
  }

  async fail(dto: FailDto): Promise<AiJob> {
    const job = await this.jobRepo.findOne({ where: { id: dto.jobId } });
    if (!job) {
      throw new NotFoundException({ message: 'AI job not found', error: 'not_found' });
    }
    job.attempts += 1;
    job.lastError = `${dto.errorCode}: ${dto.errorMessage}`;
    if (job.attempts >= job.maxAttempts) {
      job.status = 'failed';
    } else {
      job.status = 'queued';
      job.nextRunAt = new Date(Date.now() + (dto.retryInMs ?? 30_000));
    }
    return this.jobRepo.save(job);
  }

  async enqueueCaptionJob(postId: string): Promise<AiJob> {
    const job = this.jobRepo.create({
      postId,
      type: 'caption',
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      nextRunAt: new Date(),
    });
    const saved = await this.jobRepo.save(job);
    await this.aiQueue.add('caption', { jobId: saved.id }, { jobId: saved.id });
    return saved;
  }
}
