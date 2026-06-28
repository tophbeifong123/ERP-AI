import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { Business } from '../../database/entities/business.entity';
import { Post } from '../../database/entities/post.entity';
import { ContentPlan } from '../../database/entities/content-plan.entity';
import { AiJob } from '../../database/entities/ai-job.entity';
import { FacebookPage } from '../../database/entities/facebook-page.entity';
import { Service } from '../../database/entities/service.entity';
import { PostFeaturedService } from '../../database/entities/post-featured-service.entity';
import { File } from '../../database/entities/file.entity';
import { PostStateMachine } from '../posts/state-machine';
import { PostEventsService } from '../posts/post-events.service';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../ai/ai.service';

interface DecideRequestBody {
  callbackUrl: string;
  planId: string;
  business: {
    id: string;
    name: string;
    industry: string;
    description: string | null;
    tone: string | null;
    keywords: string[];
    targetAudience: string | null;
    postsPerWeekTarget: number;
    minGapDays: number;
    logoPublicUrl: string | null;
  };
  services: Array<{
    id: string;
    name: string;
    description: string | null;
    priceMinor: number;
    currency: string;
    isActive: boolean;
  }>;
  recentPosts: Array<{ postedAt: string; postType: string }>;
  recentFeaturedServiceIds: string[];
  postsThisWeek: number;
  lastPostAt: string | null;
  nowIso: string;
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(Business) private businessRepo: Repository<Business>,
    @InjectRepository(Post) private postRepo: Repository<Post>,
    @InjectRepository(ContentPlan) private planRepo: Repository<ContentPlan>,
    @InjectRepository(AiJob) private jobRepo: Repository<AiJob>,
    @InjectRepository(FacebookPage) private pageRepo: Repository<FacebookPage>,
    @InjectRepository(Service) private serviceRepo: Repository<Service>,
    @InjectRepository(PostFeaturedService) private featuredRepo: Repository<PostFeaturedService>,
    @InjectRepository(File) private fileRepo: Repository<File>,
    @InjectQueue('dispatch-post') private dispatchQueue: Queue,
    @InjectQueue('refresh-token-cleanup') private refreshTokenQueue: Queue,
    private postEvents: PostEventsService,
    private aiService: AiService,
  ) {}

  @Cron('0 6 * * *', { timeZone: 'Asia/Bangkok' })
  async dailyDecide() {
    this.logger.log('Running daily decide cron');
    const businesses = await this.businessRepo.find({
      where: {
        autoPostEnabled: true,
        autoPostMode: 'ai_decide',
        deletedAt: IsNull(),
      },
    });
    if (businesses.length === 0) {
      this.logger.log('No ai_decide businesses to process');
      return;
    }

    const aiDecisionUrl = this.configService.get<string>('app.ai.decisionUrl');
    const internalKey = this.configService.get<string>('app.internalApiKey');
    const appUrl = this.configService.get<string>('app.appUrl');
    const callbackUrl = `${appUrl}/internal/ai/decide/callback`;

    for (const biz of businesses) {
      try {
        const plan = await this.aiService.createPendingPlan(biz.id);

        const services = await this.serviceRepo.find({
          where: { businessId: biz.id, isActive: true, deletedAt: IsNull() },
        });

        const recentPosts = await this.postRepo.find({
          where: {
            businessId: biz.id,
            status: 'posted',
            deletedAt: IsNull(),
          },
          order: { postedAt: 'DESC' },
          take: 20,
        });
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000);
        const recentInWindow = recentPosts
          .filter((p) => p.postedAt && p.postedAt >= fourteenDaysAgo)
          .map((p) => ({ postedAt: p.postedAt!.toISOString(), postType: p.postType ?? '' }));

        const lastThreePostedIds = recentPosts
          .filter((p) => p.postedAt)
          .slice(0, 3)
          .map((p) => p.id);
        let recentFeatured: string[] = [];
        if (lastThreePostedIds.length > 0) {
          const featuredRows = await this.featuredRepo
            .createQueryBuilder('pf')
            .where('pf.postId IN (:...ids)', { ids: lastThreePostedIds })
            .getMany();
          recentFeatured = Array.from(new Set(featuredRows.map((r) => r.serviceId)));
        }

        const mondayBkk = this.getMondayBangkok(new Date());
        const postsThisWeek = await this.postRepo
          .createQueryBuilder('post')
          .where('post.businessId = :bid', { bid: biz.id })
          .andWhere("post.status = 'posted'")
          .andWhere('post.postedAt >= :since', { since: mondayBkk })
          .andWhere('post.deletedAt IS NULL')
          .getCount();

        const lastPost = recentPosts[0] ?? null;
        const lastPostAt = lastPost?.postedAt ? lastPost.postedAt.toISOString() : null;

        let logoPublicUrl: string | null = null;
        if (biz.logoFileId) {
          const logo = await this.fileRepo.findOne({ where: { id: biz.logoFileId } });
          logoPublicUrl = logo?.publicUrl ?? null;
        }

        const payload: DecideRequestBody = {
          callbackUrl,
          planId: plan.id,
          business: {
            id: biz.id,
            name: biz.name,
            industry: biz.industry,
            description: biz.description,
            tone: biz.tone,
            keywords: biz.keywords ?? [],
            targetAudience: biz.targetAudience,
            postsPerWeekTarget: biz.postsPerWeekTarget,
            minGapDays: biz.minGapDays,
            logoPublicUrl,
          },
          services: services.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            priceMinor: Number(s.priceMinor),
            currency: s.currency,
            isActive: s.isActive,
          })),
          recentPosts: recentInWindow,
          recentFeaturedServiceIds: recentFeatured,
          postsThisWeek,
          lastPostAt,
          nowIso: new Date().toISOString(),
        };

        const res = await fetch(`${aiDecisionUrl}/decide`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': internalKey ?? '',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text();
          this.logger.error(
            `AI Decision call failed for business ${biz.id}: status=${res.status} body=${text.slice(0, 300)}`,
          );
          plan.status = 'cancelled';
          plan.aiReasoning = `AI service call failed: ${res.status}`;
          await this.planRepo.save(plan);
          continue;
        }

        this.logger.log(
          `Daily decide enqueued for business ${biz.id} plan=${plan.id} services=${services.length}`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`dailyDecide failed for business ${biz.id}: ${message}`);
      }
    }
  }

  private getMondayBangkok(date: Date): Date {
    const bkkMs = date.getTime() + 7 * 3600 * 1000;
    const bkk = new Date(bkkMs);
    const day = bkk.getUTCDay();
    const daysSinceMonday = (day + 6) % 7;
    bkk.setUTCDate(bkk.getUTCDate() - daysSinceMonday);
    bkk.setUTCHours(0, 0, 0, 0);
    return new Date(bkk.getTime() - 7 * 3600 * 1000);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async materializeFixedSchedule() {
    this.logger.log('Running materialize fixed schedule cron');
    const businesses = await this.businessRepo.find({
      where: { autoPostEnabled: true, autoPostMode: 'fixed_schedule', deletedAt: IsNull() },
    });
    for (const biz of businesses) {
      for (const rule of biz.fixedScheduleRules ?? []) {
        this.logger.log(`Fixed schedule rule for ${biz.id}: day=${rule.dayOfWeek} time=${rule.time}`);
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchDuePosts() {
    const now = new Date();
    const due = await this.postRepo.find({
      where: { status: 'approved', scheduledAt: LessThanOrEqual(now), deletedAt: IsNull() },
      take: 50,
    });
    for (const post of due) {
      await this.dispatchQueue.add('dispatch', { postId: post.id }, { jobId: `dispatch-${post.id}` });
      this.logger.log(`Enqueued dispatch for post ${post.id}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expirePendingApprovals() {
    const now = new Date();
    const expired = await this.postRepo
      .createQueryBuilder('post')
      .where("post.status = 'pending_approval'")
      .andWhere('post.approvalDeadline IS NOT NULL')
      .andWhere('post.approvalDeadline < :now', { now })
      .andWhere('post.deletedAt IS NULL')
      .getMany();
    for (const post of expired) {
      PostStateMachine.assertTransition(post.status, 'expired');
      post.status = 'expired';
      post.rejectionReason = 'timeout';
      await this.postRepo.save(post);
      await this.postEvents.emitForStatus(post.id, 'expired', { reason: 'timeout' });
      this.logger.warn(`Post ${post.id} expired due to timeout`);
    }
  }

  @Cron('*/30 * * * * *')
  async retryAiJobs() {
    const now = new Date();
    const due = await this.jobRepo.find({
      where: { status: 'queued', nextRunAt: LessThanOrEqual(now) },
      take: 50,
      order: { nextRunAt: 'ASC' },
    });
    for (const job of due) {
      this.logger.log(`Retrying AI job ${job.id} type=${job.type} attempt=${job.attempts + 1}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async refreshFacebookTokens() {
    const now = new Date();
    const expiringSoon = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const pages = await this.pageRepo
      .createQueryBuilder('page')
      .where('page.tokenExpiresAt IS NOT NULL')
      .andWhere('page.tokenExpiresAt < :soon', { soon: expiringSoon })
      .getMany();
    for (const page of pages) {
      this.logger.log(`Refreshing FB token for page ${page.id}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async enqueueRefreshTokenCleanup() {
    await this.refreshTokenQueue.add('cleanup', { olderThanDays: 30 }, { jobId: 'rt-cleanup-daily' });
    this.logger.log('Enqueued refresh-token cleanup');
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOrphanFiles() {
    this.logger.log('Running cleanup orphan files cron');
  }
}
