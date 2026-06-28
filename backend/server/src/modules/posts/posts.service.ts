import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  Post,
  PostStatus,
  RejectionReason,
} from '../../database/entities/post.entity';
import { PostMedia } from '../../database/entities/post-media.entity';
import { PostFeaturedService } from '../../database/entities/post-featured-service.entity';
import { Business } from '../../database/entities/business.entity';
import { AiJob } from '../../database/entities/ai-job.entity';
import { PostStateMachine } from './state-machine';
import { PostEventsService } from './post-events.service';

export interface CreatePostDto {
  businessId: string;
  fbPageId?: string;
  caption?: string;
  postType?: string;
  generationSource?: 'auto_ai' | 'fixed_schedule' | 'manual';
  scheduledAt?: Date;
  approvalDeadline?: Date;
  mediaIds?: string[];
  featuredServiceIds?: string[];
}

export interface UpdatePostDto {
  caption?: string;
  scheduledAt?: Date;
  approvalDeadline?: Date;
  featuredServiceIds?: string[];
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectRepository(Post) private postRepo: Repository<Post>,
    @InjectRepository(PostMedia) private mediaRepo: Repository<PostMedia>,
    @InjectRepository(PostFeaturedService)
    private featuredRepo: Repository<PostFeaturedService>,
    @InjectRepository(Business) private businessRepo: Repository<Business>,
    @InjectRepository(AiJob) private jobRepo: Repository<AiJob>,
    @InjectQueue('caption') private captionQueue: Queue,
    @InjectQueue('media') private mediaQueue: Queue,
    private postEvents: PostEventsService,
  ) {}

  async create(ownerId: string, dto: CreatePostDto): Promise<Post> {
    const business = await this.businessRepo.findOne({
      where: { id: dto.businessId, ownerId, deletedAt: IsNull() },
    });
    if (!business) {
      throw new NotFoundException({
        message: 'Business not found',
        error: 'not_found',
      });
    }

    const post = this.postRepo.create({
      businessId: dto.businessId,
      fbPageId: dto.fbPageId ?? null,
      caption: dto.caption ?? null,
      status: 'draft',
      postType: (dto.postType as Post['postType']) ?? null,
      generationSource: dto.generationSource ?? 'manual',
      scheduledAt: dto.scheduledAt ?? null,
      approvalDeadline: dto.approvalDeadline ?? null,
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

    if (saved.generationSource === 'auto_ai') {
      await this.enqueueAiPipeline(saved.id);
    }

    return saved;
  }

  async enqueueAiPipeline(postId: string): Promise<{
    captionJobId: string;
    imageJobId: string;
    shortVideoJobId: string;
  }> {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException({
        message: 'Post not found',
        error: 'not_found',
      });
    }

    const captionJob = await this.jobRepo.save(
      this.jobRepo.create({
        postId,
        type: 'caption',
        status: 'queued',
        attempts: 0,
        maxAttempts: 3,
        nextRunAt: new Date(),
      }),
    );
    const imageJob = await this.jobRepo.save(
      this.jobRepo.create({
        postId,
        type: 'image',
        status: 'queued',
        attempts: 0,
        maxAttempts: 3,
        nextRunAt: new Date(),
      }),
    );
    const shortVideoJob = await this.jobRepo.save(
      this.jobRepo.create({
        postId,
        type: 'short_video',
        status: 'queued',
        attempts: 0,
        maxAttempts: 3,
        nextRunAt: new Date(),
      }),
    );

    await this.captionQueue.add(
      'caption',
      { jobId: captionJob.id },
      { jobId: captionJob.id },
    );
    await this.mediaQueue.add(
      'image',
      { jobId: imageJob.id },
      { jobId: imageJob.id },
    );
    await this.mediaQueue.add(
      'short_video',
      { jobId: shortVideoJob.id },
      { jobId: shortVideoJob.id },
    );

    if (post.status === 'draft') {
      post.status = 'generating';
      await this.postRepo.save(post);
    }

    this.logger.log(
      `Enqueued AI pipeline for post ${postId}: caption=${captionJob.id}`,
    );
    return {
      captionJobId: captionJob.id,
      imageJobId: imageJob.id,
      shortVideoJobId: shortVideoJob.id,
    };
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
      relations: { media: true, aiJobs: true },
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
    if (post.status !== 'draft' && post.status !== 'pending_approval') {
      throw new BadRequestException({
        message: `Cannot edit post in status ${post.status}`,
        error: 'invalid_state_for_edit',
      });
    }
    if (dto.caption !== undefined) post.caption = dto.caption;
    if (dto.scheduledAt !== undefined) post.scheduledAt = dto.scheduledAt;
    if (dto.approvalDeadline !== undefined)
      post.approvalDeadline = dto.approvalDeadline;
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
