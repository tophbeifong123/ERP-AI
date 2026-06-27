import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post, PostStatus } from '../../database/entities/post.entity';
import { Business } from '../../database/entities/business.entity';
import { User } from '../../database/entities/user.entity';
import { FacebookPage } from '../../database/entities/facebook-page.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { FacebookService } from '../facebook/facebook.service';

export type PostLifecycleEvent =
  | 'post_ready'
  | 'post_posted'
  | 'post_failed'
  | 'post_expired';

export interface PostEventContext {
  post: Post;
  business: Business;
  owner: User;
  fbPostId?: string;
  errorCode?: string;
  errorMessage?: string;
  reason?: 'user_rejected' | 'timeout';
}

@Injectable()
export class PostEventsService {
  private readonly logger = new Logger(PostEventsService.name);

  constructor(
    @InjectRepository(Post) private postRepo: Repository<Post>,
    @InjectRepository(Business) private businessRepo: Repository<Business>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(FacebookPage) private pageRepo: Repository<FacebookPage>,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
    private facebookService: FacebookService,
  ) {}

  async emit(event: PostLifecycleEvent, ctx: PostEventContext): Promise<void> {
    const { post, business, owner } = ctx;
    try {
      switch (event) {
        case 'post_ready':
          await this.notificationsService.create(owner.id, 'post_ready', post.id);
          await this.emailService.enqueuePostReady(owner.id, owner.email, {
            businessName: business.name,
            postId: post.id,
            caption: post.caption ?? '',
            postType: post.postType,
            approvalDeadline: post.approvalDeadline ? post.approvalDeadline.toISOString() : null,
          });
          break;
        case 'post_posted':
          await this.notificationsService.create(owner.id, 'post_posted', post.id);
          if (post.fbPageId) {
            const page = await this.pageRepo.findOne({ where: { id: post.fbPageId } });
            await this.emailService.enqueuePostPosted(owner.id, owner.email, {
              businessName: business.name,
              postId: post.id,
              caption: post.caption ?? '',
              fbPostId: post.fbPostId ?? ctx.fbPostId ?? '',
              pageName: page?.pageName ?? 'Facebook',
              viewUrl: post.fbPostId
                ? `https://facebook.com/${post.fbPostId}`
                : undefined,
            });
          }
          break;
        case 'post_failed':
          await this.notificationsService.create(owner.id, 'post_failed', post.id);
          await this.emailService.enqueuePostFailed(owner.id, owner.email, {
            businessName: business.name,
            postId: post.id,
            caption: post.caption ?? '',
            errorCode: ctx.errorCode ?? 'unknown',
            errorMessage: ctx.errorMessage ?? 'Post dispatch failed',
          });
          break;
        case 'post_expired':
          await this.notificationsService.create(owner.id, 'post_expired', post.id);
          await this.emailService.enqueuePostExpired(owner.id, owner.email, {
            businessName: business.name,
            postId: post.id,
            caption: post.caption ?? '',
            reason: ctx.reason ?? 'user_rejected',
          });
          break;
      }
    } catch (err) {
      this.logger.error(
        `Failed to emit ${event} for post ${post.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async loadContext(postId: string): Promise<PostEventContext | null> {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) return null;
    const business = await this.businessRepo.findOne({ where: { id: post.businessId } });
    if (!business) return null;
    const owner = await this.userRepo.findOne({ where: { id: business.ownerId } });
    if (!owner) return null;
    return { post, business, owner };
  }

  async emitForStatus(postId: string, to: PostStatus, extra: { fbPostId?: string; errorCode?: string; errorMessage?: string; reason?: 'user_rejected' | 'timeout' } = {}): Promise<void> {
    const ctx = await this.loadContext(postId);
    if (!ctx) return;
    if (to === 'pending_approval') {
      await this.emit('post_ready', { ...ctx, ...extra });
    } else if (to === 'posted') {
      await this.emit('post_posted', { ...ctx, ...extra });
    } else if (to === 'failed') {
      await this.emit('post_failed', { ...ctx, ...extra });
    } else if (to === 'rejected' || to === 'expired') {
      await this.emit('post_expired', { ...ctx, ...extra });
    }
  }
}
