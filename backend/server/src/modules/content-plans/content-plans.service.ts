import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  ContentPlan,
  ContentPlanStatus,
} from '../../database/entities/content-plan.entity';
import { Business } from '../../database/entities/business.entity';
import { Post } from '../../database/entities/post.entity';

@Injectable()
export class ContentPlansService {
  constructor(
    @InjectRepository(ContentPlan) private planRepo: Repository<ContentPlan>,
    @InjectRepository(Business) private businessRepo: Repository<Business>,
    @InjectRepository(Post) private postRepo: Repository<Post>,
  ) {}

  async list(filter: {
    businessId?: string;
    status?: ContentPlanStatus;
    decidedBy?: 'ai' | 'user';
  }): Promise<ContentPlan[]> {
    const qb = this.planRepo.createQueryBuilder('plan');
    if (filter.businessId)
      qb.andWhere('plan.businessId = :bid', { bid: filter.businessId });
    if (filter.status)
      qb.andWhere('plan.status = :status', { status: filter.status });
    if (filter.decidedBy)
      qb.andWhere('plan.decidedBy = :by', { by: filter.decidedBy });
    qb.orderBy('plan.createdAt', 'DESC');
    return qb.getMany();
  }

  async getOne(id: string): Promise<ContentPlan> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException({
        message: 'Content plan not found',
        error: 'not_found',
      });
    }
    return plan;
  }

  async cancel(id: string): Promise<ContentPlan> {
    const plan = await this.getOne(id);
    plan.status = 'cancelled';
    return this.planRepo.save(plan);
  }

  async materialize(
    planId: string,
  ): Promise<{ plan: ContentPlan; post: Post }> {
    const plan = await this.getOne(planId);
    if (plan.status === 'materialized') {
      throw new NotFoundException({
        message: 'Plan already materialized',
        error: 'already_materialized',
      });
    }
    if (plan.status === 'cancelled') {
      throw new NotFoundException({
        message: 'Plan cancelled',
        error: 'plan_cancelled',
      });
    }

    const post = this.postRepo.create({
      businessId: plan.businessId,
      caption: plan.suggestedCaptionHint,
      status: 'draft',
      postType: (plan.suggestedPostType as Post['postType']) ?? null,
      generationSource: 'auto_ai',
      scheduledAt: plan.suggestedScheduledAt ?? null,
      approvalDeadline: plan.suggestedScheduledAt
        ? new Date(plan.suggestedScheduledAt.getTime() + 24 * 3600 * 1000)
        : null,
    });
    const saved = await this.postRepo.save(post);

    plan.status = 'materialized';
    plan.materializedPostId = saved.id;
    await this.planRepo.save(plan);

    return { plan, post: saved };
  }
}
