import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Post } from '../../database/entities/post.entity';
import { PostMedia } from '../../database/entities/post-media.entity';
import { FacebookPage } from '../../database/entities/facebook-page.entity';
import { File } from '../../database/entities/file.entity';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PostEventsService } from '../posts/post-events.service';

export interface DispatchJobData {
  postId: string;
}

interface FbErrorBody {
  error?: { message: string; code: number; error_subcode?: number };
}

@Processor('dispatch-post')
export class DispatchPostProcessor extends WorkerHost {
  private readonly logger = new Logger(DispatchPostProcessor.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(Post) private postRepo: Repository<Post>,
    @InjectRepository(PostMedia) private postMediaRepo: Repository<PostMedia>,
    @InjectRepository(File) private fileRepo: Repository<File>,
    @InjectRepository(FacebookPage) private pageRepo: Repository<FacebookPage>,
    private encryption: EncryptionService,
    private postEvents: PostEventsService,
  ) {
    super();
  }

  async process(job: Job<DispatchJobData>): Promise<{ fbPostId: string; endpoint: string }> {
    const { postId } = job.data;
    const post = await this.postRepo.findOne({
      where: { id: postId, deletedAt: IsNull() },
      relations: { media: true },
    });
    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }
    if (post.status === 'posted') {
      return { fbPostId: post.fbPostId ?? '', endpoint: 'skipped' };
    }
    if (post.status !== 'approved') {
      this.logger.warn(`Post ${postId} is in status ${post.status}, skipping dispatch`);
      return { fbPostId: '', endpoint: 'skipped' };
    }
    if (!post.fbPageId) {
      const msg =
        'No Facebook page connected to this business. Please connect a page in Settings before scheduling a post.';
      this.logger.error(`Dispatch post ${postId} aborted: ${msg}`);
      post.status = 'failed';
      post.errorCode = 'E_NO_FB_PAGE';
      post.errorMessage = msg;
      await this.postRepo.save(post);
      await this.postEvents.emitForStatus(post.id, 'failed', {
        errorCode: 'E_NO_FB_PAGE',
        errorMessage: msg,
      });
      throw new Error(msg);
    }

    const page = await this.pageRepo.findOne({
      where: { id: post.fbPageId, deletedAt: IsNull() },
    });
    if (!page) {
      throw new Error(`Facebook page ${post.fbPageId} not found`);
    }
    let accessToken: string;
    try {
      accessToken = this.encryption.decrypt(page.accessTokenEncrypted);
    } catch (err) {
      const msg = `Failed to decrypt page access token: ${err instanceof Error ? err.message : String(err)}`;
      this.logger.error(`Dispatch post ${postId} aborted: ${msg}`);
      post.status = 'failed';
      post.errorCode = 'E_TOKEN_DECRYPT';
      post.errorMessage = msg;
      await this.postRepo.save(post);
      await this.postEvents.emitForStatus(post.id, 'failed', { errorCode: 'E_TOKEN_DECRYPT', errorMessage: msg });
      throw new Error(msg);
    }
    const graphVersion = this.configService.get<string>('app.facebook.graphVersion') || 'v19.0';

    // Pick the first media (MVP: 1 media per post). Order by order_index ASC.
    const mediaRow = (post.media || []).sort((a, b) => a.orderIndex - b.orderIndex)[0] || null;
    let file: File | null = null;
    if (mediaRow) {
      file = await this.fileRepo.findOne({ where: { id: mediaRow.fileId } });
    }

    const caption = post.caption ?? '';
    const baseUrl = `https://graph.facebook.com/${graphVersion}/${page.fbPageId}`;
    let endpoint = `${baseUrl}/feed`;
    let body: Record<string, unknown> = { message: caption, access_token: accessToken };

    if (file && mediaRow) {
      if (mediaRow.kind === 'image') {
        endpoint = `${baseUrl}/photos`;
        body = {
          caption,
          access_token: accessToken,
          url: file.publicUrl,
          published: true,
        };
      } else if (mediaRow.kind === 'short_video') {
        endpoint = `${baseUrl}/videos`;
        body = {
          description: caption,
          access_token: accessToken,
          file_url: file.publicUrl,
        };
      }
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { id?: string } & FbErrorBody;
      if (!res.ok || !data.id) {
        const msg =
          data.error?.message ?? `Facebook API returned ${res.status}`;
        const code = data.error?.code ? `E${data.error.code}` : 'E_FB';
        post.status = 'failed';
        post.errorCode = code;
        post.errorMessage = msg;
        await this.postRepo.save(post);
        await this.postEvents.emitForStatus(post.id, 'failed', {
          errorCode: code,
          errorMessage: msg,
        });
        throw new Error(msg);
      }

      post.fbPostId = data.id;
      post.status = 'posted';
      post.postedAt = new Date();
      post.errorCode = null;
      post.errorMessage = null;
      await this.postRepo.save(post);
      await this.postEvents.emitForStatus(post.id, 'posted', { fbPostId: data.id });
      this.logger.log(
        `Post ${postId} posted to FB (id=${data.id}) via ${endpoint.replace(baseUrl, '')}`,
      );
      return { fbPostId: data.id, endpoint };
    } catch (err) {
      this.logger.error(
        `Dispatch post ${postId} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}
