import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Post } from '../../database/entities/post.entity';
import { FacebookPage } from '../../database/entities/facebook-page.entity';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PostEventsService } from '../posts/post-events.service';

export interface DispatchJobData {
  postId: string;
}

@Processor('dispatch-post')
export class DispatchPostProcessor extends WorkerHost {
  private readonly logger = new Logger(DispatchPostProcessor.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(Post) private postRepo: Repository<Post>,
    @InjectRepository(FacebookPage) private pageRepo: Repository<FacebookPage>,
    private encryption: EncryptionService,
    private postEvents: PostEventsService,
  ) {
    super();
  }

  async process(job: Job<DispatchJobData>): Promise<{ fbPostId: string }> {
    const { postId } = job.data;
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }
    if (post.status === 'posted') {
      return { fbPostId: post.fbPostId ?? '' };
    }
    if (post.status !== 'approved') {
      this.logger.warn(
        `Post ${postId} is in status ${post.status}, skipping dispatch`,
      );
      return { fbPostId: '' };
    }
    if (!post.fbPageId) {
      throw new Error(`Post ${postId} has no fbPageId`);
    }

    const page = await this.pageRepo.findOne({
      where: { id: post.fbPageId, deletedAt: IsNull() },
    });
    if (!page) {
      throw new Error(`Facebook page ${post.fbPageId} not found`);
    }
    const accessToken = this.encryption.decrypt(page.accessTokenEncrypted);
    const graphVersion =
      this.configService.get<string>('app.facebook.graphVersion') || 'v19.0';

    try {
      const res = await fetch(
        `https://graph.facebook.com/${graphVersion}/${page.fbPageId}/feed`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: post.caption ?? '',
            access_token: accessToken,
          }),
        },
      );
      const data = (await res.json()) as {
        id?: string;
        error?: { message: string; code: number };
      };
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
      await this.postEvents.emitForStatus(post.id, 'posted', {
        fbPostId: data.id,
      });
      this.logger.log(`Post ${postId} posted to FB (id=${data.id})`);
      return { fbPostId: data.id };
    } catch (err) {
      this.logger.error(
        `Dispatch post ${postId} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}
