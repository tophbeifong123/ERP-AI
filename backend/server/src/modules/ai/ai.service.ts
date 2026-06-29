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
import { Post } from '../../database/entities/post.entity';
import {
  PostMedia,
  PostMediaKind,
} from '../../database/entities/post-media.entity';
import { AiJob } from '../../database/entities/ai-job.entity';
import { Business } from '../../database/entities/business.entity';
import { Service } from '../../database/entities/service.entity';
import { File } from '../../database/entities/file.entity';
import { PostEventsService } from '../posts/post-events.service';
import { PostsService } from '../posts/posts.service';

export interface DecideDto {
  jobId: string;
  result: {
    suggestedScheduledAt: string;
    reasoning?: string;
  };
}

export interface CaptionDto {
  jobId: string;
  result?: { caption: string };
  error?: { code: string; message: string };
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
  metadata?: Record<string, unknown>;
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
    @InjectRepository(PostMedia)
    private postMediaRepo: Repository<PostMedia>,
    @InjectRepository(AiJob) private jobRepo: Repository<AiJob>,
    @InjectRepository(Business) private businessRepo: Repository<Business>,
    @InjectRepository(Service) private serviceRepo: Repository<Service>,
    @InjectRepository(File) private fileRepo: Repository<File>,
    @InjectQueue('ai') private aiQueue: Queue,
    private postEvents: PostEventsService,
    private postsService: PostsService,
  ) {}

  /**
   * Decision callback: AI recommends a scheduled time for the post.
   */
  async decisionCallback(dto: DecideDto): Promise<{
    job: AiJob;
    post: Post;
  }> {
    const job = await this.jobRepo.findOne({ where: { id: dto.jobId } });
    if (!job) {
      throw new NotFoundException({
        message: 'AI job not found',
        error: 'not_found',
      });
    }
    if (job.type !== 'decision') {
      throw new BadRequestException({
        message: 'Job is not a decision job',
        error: 'wrong_job_type',
      });
    }

    const post = await this.postRepo.findOne({ where: { id: job.postId } });
    if (!post) {
      throw new NotFoundException({
        message: 'Post not found',
        error: 'not_found',
      });
    }

    const suggestedAt = new Date(dto.result.suggestedScheduledAt);
    if (Number.isNaN(suggestedAt.getTime())) {
      throw new BadRequestException({
        message: 'result.suggestedScheduledAt is not a valid ISO timestamp',
        error: 'invalid_payload',
      });
    }

    post.suggestedScheduledAt = suggestedAt;
    // If post is still in 'generating', we don't set scheduledAt yet.
    // The PostsService.checkPostGenerationComplete() will set scheduledAt
    // from suggestedScheduledAt when all jobs succeed.
    if (post.status === 'pending_approval' || post.status === 'approved') {
      post.scheduledAt = suggestedAt;
    }
    const savedPost = await this.postRepo.save(post);

    job.status = 'succeeded';
    job.result = {
      suggestedScheduledAt: suggestedAt.toISOString(),
      reasoning: dto.result.reasoning ?? null,
    };
    const savedJob = await this.jobRepo.save(job);

    this.logger.log(
      `Decision job ${dto.jobId} succeeded; suggested ${suggestedAt.toISOString()}`,
    );

    return { job: savedJob, post: savedPost };
  }

  async captionCallback(dto: CaptionDto): Promise<Post> {
    const job = await this.jobRepo.findOne({ where: { id: dto.jobId } });
    if (!job) {
      throw new NotFoundException({
        message: 'AI job not found',
        error: 'not_found',
      });
    }
    if (job.type !== 'caption') {
      throw new BadRequestException({
        message: 'Job is not a caption job',
        error: 'wrong_job_type',
      });
    }

    const post = await this.postRepo.findOne({ where: { id: job.postId } });
    if (!post) {
      throw new NotFoundException({
        message: 'Post not found',
        error: 'not_found',
      });
    }

    // Reject empty/invalid caption payloads (e.g. when AI service sent an
    // error callback instead of a real caption). Mark the job as failed
    // so the post-generation-complete watcher transitions the post.
    if (dto.error) {
      const msg = `AI service error: ${dto.error.code} - ${dto.error.message}`;
      this.logger.error(`Caption job ${dto.jobId} failed: ${msg}`);
      job.attempts = job.maxAttempts;
      job.status = 'failed';
      job.lastError = msg;
      await this.jobRepo.save(job);
      await this.postsService.checkPostGenerationComplete(post.id);
      throw new BadRequestException({ message: msg, error: 'ai_error' });
    }

    const caption = dto.result?.caption;
    if (!caption || !caption.trim()) {
      const msg = 'AI service returned empty caption';
      this.logger.error(`Caption job ${dto.jobId} failed: ${msg}`);
      job.attempts = job.maxAttempts;
      job.status = 'failed';
      job.lastError = msg;
      await this.jobRepo.save(job);
      await this.postsService.checkPostGenerationComplete(post.id);
      throw new BadRequestException({ message: msg, error: 'empty_caption' });
    }

    post.caption = caption;
    const saved = await this.postRepo.save(post);

    job.status = 'succeeded';
    job.result = { caption };
    await this.jobRepo.save(job);

    this.logger.log(`Caption job ${dto.jobId} succeeded for post ${post.id}`);
    return saved;
  }

  /**
   * Handle the n8n media callback (image or short_video).
   * On success: create a File row + PostMedia row, mark AiJob succeeded.
   * On error: increment attempts and either re-queue or mark failed.
   */
  async mediaCallback(dto: MediaCallbackDto): Promise<{
    job: AiJob;
    post: Post | null;
    file?: File;
    postMedia?: PostMedia;
  }> {
    const job = await this.jobRepo.findOne({ where: { id: dto.jobId } });
    if (!job) {
      throw new NotFoundException({
        message: 'AI job not found',
        error: 'not_found',
      });
    }
    if (job.type !== 'image' && job.type !== 'short_video') {
      throw new BadRequestException({
        message: 'Job is not an image or short_video job',
        error: 'wrong_job_type',
      });
    }

    // Error path
    if (dto.error) {
      job.attempts += 1;
      job.lastError = `${dto.error.code}: ${dto.error.message}`;
      job.errorCode = dto.error.code;
      if (dto.metadata && Object.keys(dto.metadata).length > 0) {
        job.metadata = { ...(job.metadata || {}), ...dto.metadata };
      }
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
      throw new BadRequestException({
        message: 'result.storageKey and result.publicUrl are required',
        error: 'invalid_payload',
      });
    }

    const post = await this.postRepo.findOne({ where: { id: job.postId } });
    if (!post) {
      throw new NotFoundException({
        message: 'Post not found',
        error: 'not_found',
      });
    }
    const business = await this.businessRepo.findOne({
      where: { id: post.businessId, deletedAt: IsNull() },
    });
    if (!business) {
      throw new NotFoundException({
        message: 'Business not found',
        error: 'not_found',
      });
    }

    const kind: PostMediaKind =
      job.type === 'short_video' ? 'short_video' : 'image';
    const mime =
      dto.result.mime || (kind === 'short_video' ? 'video/mp4' : 'image/png');

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
      const existingCount = await this.postMediaRepo.count({
        where: { postId: post.id },
      });
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
      throw new NotFoundException({
        message: 'AI job not found',
        error: 'not_found',
      });
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
