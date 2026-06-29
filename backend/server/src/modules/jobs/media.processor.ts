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
import { File } from '../../database/entities/file.entity';
import { S3Service } from '../files/s3.service';

export interface MediaJobData {
  jobId: string;
}

// AI-optimised media request handed over by the caption callback (stored on the
// media job's payload). Contents are the AI Media (n8n) snake_case format.
interface OptimizedMediaRequest {
  content_type?: string;
  aspect_ratio?: string;
  style?: string;
  negative_prompt?: string;
  prompt?: string;
  master_prompt?: string | null;
  scenes?: { prompt: string }[];
}

const PRESIGNED_EXPIRES_SEC = 600; // 10 min (covers Veo ~3 min + buffers)

@Processor('media')
export class MediaProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaProcessor.name);

  constructor(
    private configService: ConfigService,
    private s3Service: S3Service,
    @InjectRepository(AiJob) private jobRepo: Repository<AiJob>,
    @InjectRepository(Post) private postRepo: Repository<Post>,
    @InjectRepository(Business) private businessRepo: Repository<Business>,
    @InjectRepository(Service) private serviceRepo: Repository<Service>,
    @InjectRepository(PostFeaturedService) private featuredRepo: Repository<PostFeaturedService>,
    @InjectRepository(File) private fileRepo: Repository<File>,
  ) {
    super();
  }

  async process(job: Job<MediaJobData>): Promise<{ status: string }> {
    const { jobId } = job.data;
    const aiJob = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!aiJob) {
      this.logger.warn(`Media job ${jobId} not found, skipping`);
      return { status: 'skipped' };
    }
    if (aiJob.status === 'succeeded') {
      return { status: 'already_succeeded' };
    }

    const post = await this.postRepo.findOne({ where: { id: aiJob.postId } });
    if (!post) {
      throw new Error(`Post ${aiJob.postId} not found`);
    }

    const business = await this.businessRepo.findOne({
      where: { id: post.businessId, deletedAt: IsNull() },
    });
    if (!business) {
      throw new Error(`Business ${post.businessId} not found for media job ${jobId}`);
    }

    const isVideo = aiJob.type === 'short_video';
    const mime = isVideo ? 'video/mp4' : 'image/png';
    const maxBytes = isVideo ? 52_428_800 : 10_485_760;

    // AI-optimised media request (scenes/master_prompt/style), if the caption
    // step produced one. Falls back to the raw hint when absent.
    const mediaRequest = aiJob.payload?.mediaRequest as
      | OptimizedMediaRequest
      | undefined;

    // 1) Reserve a presigned URL so n8n can upload directly to MinIO.
    const presigned = await this.s3Service.generatePresignedUploadUrl(
      'posts/media',
      mime,
      PRESIGNED_EXPIRES_SEC,
    );

    // 2) Lookup business context (logo URL) + featured services (with image URLs)
    let logoPublicUrl: string | null = null;
    if (business.logoFileId) {
      const logo = await this.fileRepo.findOne({ where: { id: business.logoFileId } });
      logoPublicUrl = logo?.publicUrl ?? null;
    }
    const featuredRows = await this.featuredRepo.find({ where: { postId: post.id } });
    const featuredIds = featuredRows.map((r) => r.serviceId);
    const services = featuredIds.length
      ? await this.serviceRepo.find({ where: { id: In(featuredIds), deletedAt: IsNull() } })
      : [];
    const featuredServices = await Promise.all(
      services.map(async (s) => ({
        id: s.id,
        name: s.name,
        imagePublicUrl: s.imageFileId
          ? (await this.fileRepo.findOne({ where: { id: s.imageFileId } }))?.publicUrl ?? null
          : null,
      })),
    );

    const referenceImageUrls = featuredServices
      .map((s) => s.imagePublicUrl)
      .filter((url): url is string => typeof url === 'string' && url.length > 0);

    // 3) Compose payload for n8n webhook (matches docs/contracts/AI-MEDIA.md)
    const aiMediaUrl = this.configService.get<string>('app.ai.mediaUrl');
    const internalKey = this.configService.get<string>('app.internalApiKey');
    const appUrl = this.configService.get<string>('app.appUrl');
    const callbackUrl = `${appUrl}/internal/ai/${isVideo ? 'short_video' : 'image'}/callback`;

    const payload = {
      jobId: aiJob.id,
      postId: post.id,
      type: aiJob.type,
      postType: post.postType ?? null,
      callbackUrl,
      upload: {
        method: 'PUT',
        presignedUrl: presigned.presignedUrl,
        storageKey: presigned.storageKey,
        publicUrl: presigned.publicUrl,
        headers: { 'Content-Type': mime },
        expiresAt: presigned.expiresAt.toISOString(),
        maxBytes,
      },
      business: {
        id: business.id,
        name: business.name,
        industry: business.industry,
        tone: business.tone,
        keywords: business.keywords ?? [],
        logoPublicUrl,
      },
      prompt:
        mediaRequest?.prompt ??
        (aiJob.payload?.hint as string | undefined) ??
        (aiJob.payload?.captionHint as string | undefined) ??
        post.caption ??
        '',
      hint:
        (aiJob.payload?.hint as string | undefined) ??
        (aiJob.payload?.captionHint as string | undefined) ??
        null,
      caption: post.caption ?? '',
      // AI-optimised media fields (scenes for video, master_prompt overview,
      // style, aspect ratio). n8n falls back to `prompt`/`hint` if absent.
      ...(mediaRequest
        ? {
            content_type: mediaRequest.content_type,
            aspect_ratio: mediaRequest.aspect_ratio,
            style: mediaRequest.style,
            negative_prompt: mediaRequest.negative_prompt,
            master_prompt: mediaRequest.master_prompt ?? null,
            scenes: mediaRequest.scenes ?? [],
          }
        : {}),
      featuredServices,
      referenceImageUrls,
    };

    // 4) Persist a snapshot for debugging / replay
    aiJob.status = 'running';
    aiJob.attempts += 1;
    aiJob.payload = {
      ...(aiJob.payload || {}),
      upload: payload.upload,
      callbackUrl,
    };
    aiJob.lastError = null;
    await this.jobRepo.save(aiJob);

    // 5) Fire-and-forget POST to n8n. The actual result comes via callback.
    try {
      const baseUrl = (aiMediaUrl ?? 'http://localhost:5678/webhook').replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/generate-media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': internalKey ?? '',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`n8n returned ${res.status}: ${text.slice(0, 300)}`);
      }
      this.logger.log(
        `Media job ${jobId} (${aiJob.type}) queued with n8n — storageKey=${presigned.storageKey}`,
      );
      return { status: 'queued' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Media job ${jobId} dispatch to n8n failed: ${message}`);
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
