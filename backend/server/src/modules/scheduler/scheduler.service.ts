import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { Business } from '../../database/entities/business.entity';
import { Post, PostStatus } from '../../database/entities/post.entity';
import { ContentPlan } from '../../database/entities/content-plan.entity';
import { AiJob } from '../../database/entities/ai-job.entity';
import { FacebookPage } from '../../database/entities/facebook-page.entity';
import { PostStateMachine } from '../posts/state-machine';
import { PostEventsService } from '../posts/post-events.service';
import { ConfigService } from '@nestjs/config';

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
    @InjectQueue('dispatch-post') private dispatchQueue: Queue,
    @InjectQueue('refresh-token-cleanup') private refreshTokenQueue: Queue,
    private postEvents: PostEventsService,
  ) {}

  @Cron('0 6 * * *', { timeZone: 'Asia/Bangkok' })
  async dailyDecide() {
    this.logger.log('Running daily decide cron');
    const businesses = await this.businessRepo.find({
      where: { autoPostEnabled: true, deletedAt: IsNull() },
    });
    for (const biz of businesses) {
      this.logger.log(`Business ${biz.id} mode=${biz.autoPostMode} target/week=${biz.postsPerWeekTarget}`);
    }
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
