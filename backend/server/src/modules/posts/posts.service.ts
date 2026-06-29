import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  Post,
  PostMediaType,
  PostStatus,
  RejectionReason,
} from '../../database/entities/post.entity';
import { PostMedia } from '../../database/entities/post-media.entity';
import { PostFeaturedService } from '../../database/entities/post-featured-service.entity';
import { Business } from '../../database/entities/business.entity';
import { FacebookPage } from '../../database/entities/facebook-page.entity';
import { AiJob } from '../../database/entities/ai-job.entity';
import { PostStateMachine } from './state-machine';
import { PostEventsService } from './post-events.service';

export interface CreatePostDto {
  businessId: string;
  hint: string;
  postType?: string;
  mediaType?: PostMediaType;
  scheduledAt?: Date;
  mediaIds?: string[];
  featuredServiceIds?: string[];
}

export interface CreatedJobs {
  captionJobId: string;
  mediaJobId: string | null;
  decisionJobId: string;
}

export interface UpdatePostDto {
  caption?: string;
  scheduledAt?: Date;
  approvalDeadline?: Date;
  postType?: string;
  featuredServiceIds?: string[];
}

const POST_GENERATION_JOB_TYPES: AiJob['type'][] = [
  'caption',
  'image',
  'short_video',
  'decision',
];

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectRepository(Post) private postRepo: Repository<Post>,
    @InjectRepository(PostMedia) private mediaRepo: Repository<PostMedia>,
    @InjectRepository(PostFeaturedService)
    private featuredRepo: Repository<PostFeaturedService>,
    @InjectRepository(Business) private businessRepo: Repository<Business>,
    @InjectRepository(FacebookPage)
    private fbPageRepo: Repository<FacebookPage>,
    @InjectRepository(AiJob) private jobRepo: Repository<AiJob>,
    @InjectQueue('caption') private captionQueue: Queue,
    @InjectQueue('media') private mediaQueue: Queue,
    @InjectQueue('decision') private decisionQueue: Queue,
    private postEvents: PostEventsService,
  ) {}

  async create(
    ownerId: string,
    dto: CreatePostDto,
  ): Promise<{ post: Post; jobs: CreatedJobs }> {
    const business = await this.businessRepo.findOne({
      where: { id: dto.businessId, ownerId, deletedAt: IsNull() },
    });
    if (!business) {
      throw new NotFoundException({
        message: 'Business not found',
        error: 'not_found',
      });
    }

    // Auto-pick first connected Facebook page if any. We don't require it
    // here — the user can create a post before connecting FB, and the
    // dispatch cron will fail with a clear error if no page is connected
    // at the time of publishing.
    const fbPage = await this.fbPageRepo.findOne({
      where: { businessId: business.id, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });

    const now = new Date();
    const approvalDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const mediaType: PostMediaType =
      dto.mediaType === 'short_video' ? 'short_video' : 'image';

    const post = this.postRepo.create({
      businessId: dto.businessId,
      fbPageId: fbPage ? fbPage.id : null,
      caption: null,
      status: 'generating',
      postType: (dto.postType as Post['postType']) ?? 'promotion',
      mediaType,
      generationSource: 'manual',
      scheduledAt: null,
      approvalDeadline,
      suggestedScheduledAt: null,
    });
    const saved = await this.postRepo.save(post);

    if (dto.mediaIds?.length) {
      const media = dto.mediaIds.map((fileId, idx) =>
        this.mediaRepo.create({
          postId: saved.id,
          fileId,
          kind: 'image',
          orderIndex: idx,
        }),
      );
      await this.mediaRepo.save(media);
    }

    if (dto.featuredServiceIds?.length) {
      const featured = dto.featuredServiceIds.map((serviceId) =>
        this.featuredRepo.create({ postId: saved.id, serviceId }),
      );
      await this.featuredRepo.save(featured);
    }

    const jobs = await this.enqueueFullAIPipeline(saved.id, dto.hint);

    return { post: saved, jobs };
  }

  /**
   * Enqueue the AI jobs for a post. The user picks exactly ONE media
   * kind (image or short_video) when creating the post; we enqueue
   * caption + the chosen media + decision. If ENABLE_AI_MEDIA is false
   * (default), only caption + decision are enqueued (existing behavior).
   */
  async enqueueFullAIPipeline(
    postId: string,
    hint: string,
  ): Promise<CreatedJobs> {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException(`Post ${postId} not found`);
    }
    const requestedMediaType: PostMediaType = post.mediaType ?? 'image';

    const captionJob = await this.jobRepo.save(
      this.jobRepo.create({
        postId,
        type: 'caption',
        status: 'queued',
        attempts: 0,
        maxAttempts: 3,
        nextRunAt: new Date(),
        payload: { hint },
      }),
    );
    const decisionJob = await this.jobRepo.save(
      this.jobRepo.create({
        postId,
        type: 'decision',
        status: 'queued',
        attempts: 0,
        maxAttempts: 3,
        nextRunAt: new Date(),
        payload: { hint },
      }),
    );

    // Media is gated by ENABLE_AI_MEDIA env. When enabled, we enqueue
    // EXACTLY ONE media job — the kind the user picked for this post
    // (image or short_video). If the env is false, no media is enqueued
    // (caption + decision only).
    const enableMedia =
      (process.env.ENABLE_AI_MEDIA || 'false').toLowerCase() === 'true';

    let mediaJob: AiJob | null = null;
    if (enableMedia) {
      mediaJob = await this.jobRepo.save(
        this.jobRepo.create({
          postId,
          type: requestedMediaType,
          status: 'queued',
          attempts: 0,
          maxAttempts: 3,
          nextRunAt: new Date(),
          payload: { hint, mediaType: requestedMediaType },
        }),
      );
    }

    await this.captionQueue.add(
      'caption',
      { jobId: captionJob.id },
      { jobId: captionJob.id },
    );
    if (mediaJob) {
      await this.mediaQueue.add(
        mediaJob.type,
        { jobId: mediaJob.id },
        { jobId: mediaJob.id },
      );
    }
    await this.decisionQueue.add(
      'decision',
      { jobId: decisionJob.id },
      { jobId: decisionJob.id },
    );

    this.logger.log(
      `Enqueued AI pipeline for post ${postId} (media=${enableMedia ? mediaJob?.type ?? 'none' : 'disabled'})`,
    );
    return {
      captionJobId: captionJob.id,
      mediaJobId: mediaJob?.id ?? null,
      decisionJobId: decisionJob.id,
    };
  }

  /**
   * Called after any AI job callback (caption, image, short_video, decision)
   * or failure. Checks if all 4 jobs for the post are terminal.
   * If yes: post → pending_approval (all succeeded) or failed (any failed).
   */
  async checkPostGenerationComplete(postId: string): Promise<void> {
    const jobs = await this.jobRepo.find({
      where: {
        postId,
        type: In(POST_GENERATION_JOB_TYPES),
      },
    });
    if (jobs.length === 0) return;
    const allTerminal = jobs.every(
      (j) => j.status === 'succeeded' || j.status === 'failed',
    );
    if (!allTerminal) return;

    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) return;
    // Accept both 'generating' (normal path) and 'failed' (retry after
    // an earlier failure) so that a successful retry can revive a post
    // that was wrongly marked failed.
    if (post.status !== 'generating' && post.status !== 'failed') return;

    const failedJob = jobs.find((j) => j.status === 'failed');
    if (failedJob) {
      const errorMessage =
        failedJob.lastError ?? 'AI generation failed for one of the jobs';
      await this.transition(postId, 'failed', {
        errorCode: 'E_AI_GENERATION_FAILED',
        errorMessage: `AI ${failedJob.type} job failed: ${errorMessage}`,
      });
      return;
    }

    // All jobs succeeded → revive from failed (if needed) and finalize
    if (post.status === 'failed') {
      // Clear stale error fields so the UI no longer shows a red banner
      await this.postRepo.update(postId, {
        errorCode: null,
        errorMessage: null,
        rejectionReason: null,
      });
      this.logger.log(
        `Reviving post ${postId} from failed → pending_approval (all AI jobs succeeded on retry)`,
      );
    }
    if (!post.scheduledAt && post.suggestedScheduledAt) {
      post.scheduledAt = post.suggestedScheduledAt;
      await this.postRepo.save(post);
    }
    await this.transition(postId, 'pending_approval');
  }

  async list(filter: {
    businessId?: string;
    status?: PostStatus;
    postType?: string;
    from?: Date;
    to?: Date;
  }): Promise<Post[]> {
    const qb = this.postRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.media', 'media')
      .leftJoinAndSelect('media.file', 'file')
      .where('post.deletedAt IS NULL');
    if (filter.businessId)
      qb.andWhere('post.businessId = :bid', { bid: filter.businessId });
    if (filter.status)
      qb.andWhere('post.status = :status', { status: filter.status });
    if (filter.postType)
      qb.andWhere('post.postType = :pt', { pt: filter.postType });
    if (filter.from)
      qb.andWhere('post.createdAt >= :from', { from: filter.from });
    if (filter.to) qb.andWhere('post.createdAt <= :to', { to: filter.to });
    qb.orderBy('post.createdAt', 'DESC');
    return qb.getMany();
  }

  async getOne(id: string): Promise<Post> {
    const post = await this.postRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { media: { file: true }, aiJobs: true },
    });
    if (!post) {
      throw new NotFoundException({
        message: 'Post not found',
        error: 'not_found',
      });
    }
    return post;
  }

  async update(id: string, dto: UpdatePostDto): Promise<Post> {
    const post = await this.getOne(id);
    if (
      post.status !== 'draft' &&
      post.status !== 'pending_approval' &&
      post.status !== 'failed'
    ) {
      throw new BadRequestException({
        message: `Cannot edit post in status ${post.status}`,
        error: 'invalid_state_for_edit',
      });
    }
    if (dto.caption !== undefined) post.caption = dto.caption;
    if (dto.scheduledAt !== undefined) post.scheduledAt = dto.scheduledAt;
    if (dto.approvalDeadline !== undefined)
      post.approvalDeadline = dto.approvalDeadline;
    if (dto.postType !== undefined) {
      post.postType = dto.postType as Post['postType'];
    }
    await this.postRepo.save(post);

    if (dto.featuredServiceIds) {
      await this.featuredRepo.delete({ postId: id });
      if (dto.featuredServiceIds.length) {
        const featured = dto.featuredServiceIds.map((serviceId) =>
          this.featuredRepo.create({ postId: id, serviceId }),
        );
        await this.featuredRepo.save(featured);
      }
    }

    return post;
  }

  async transition(
    id: string,
    to: PostStatus,
    opts: {
      fbPostId?: string;
      reason?: RejectionReason;
      errorCode?: string;
      errorMessage?: string;
    } = {},
  ): Promise<Post> {
    const post = await this.getOne(id);
    PostStateMachine.assertTransition(post.status, to);
    post.status = to;
    if (to === 'posted') {
      post.postedAt = new Date();
      if (opts.fbPostId) post.fbPostId = opts.fbPostId;
    }
    if (to === 'rejected' && opts.reason) {
      post.rejectionReason = opts.reason;
    }
    if (to === 'failed') {
      if (opts.errorCode) post.errorCode = opts.errorCode;
      if (opts.errorMessage) post.errorMessage = opts.errorMessage;
    }
    const saved = await this.postRepo.save(post);

    void this.postEvents.emitForStatus(saved.id, to, {
      fbPostId: opts.fbPostId,
      errorCode: opts.errorCode,
      errorMessage: opts.errorMessage,
      reason: opts.reason,
    });

    return saved;
  }

  async approve(id: string): Promise<Post> {
    return this.transition(id, 'approved');
  }

  async reject(
    id: string,
    reason: RejectionReason = 'user_rejected',
  ): Promise<Post> {
    return this.transition(id, 'rejected', { reason });
  }

  async softDelete(id: string): Promise<void> {
    const post = await this.getOne(id);
    await this.postRepo.softDelete(post.id);
  }
}
