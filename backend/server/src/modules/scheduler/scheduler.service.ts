import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LessThanOrEqual, IsNull, Repository } from 'typeorm';
import { Post } from '../../database/entities/post.entity';
import { PostStateMachine } from '../posts/state-machine';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(Post) private postRepo: Repository<Post>,
    @InjectQueue('dispatch-post') private dispatchQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchDuePosts() {
    const now = new Date();
    const due = await this.postRepo.find({
      where: {
        status: 'approved',
        scheduledAt: LessThanOrEqual(now),
        deletedAt: IsNull(),
      },
      take: 50,
    });
    for (const post of due) {
      await this.dispatchQueue.add(
        'dispatch',
        { postId: post.id },
        { jobId: `dispatch-${post.id}` },
      );
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
      this.logger.warn(`Post ${post.id} expired due to timeout`);
    }
  }
}
