import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from '../../database/entities/notification.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
  ) {}

  async list(
    userId: string,
    filter: { type?: NotificationType; unreadOnly?: boolean },
  ): Promise<Notification[]> {
    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.userId = :uid', { uid: userId });
    if (filter.type) qb.andWhere('n.type = :type', { type: filter.type });
    if (filter.unreadOnly) qb.andWhere('n.readAt IS NULL');
    qb.orderBy('n.createdAt', 'DESC');
    return qb.getMany();
  }

  async getOne(userId: string, id: string): Promise<Notification> {
    const n = await this.notificationRepo.findOne({ where: { id, userId } });
    if (!n) {
      throw new NotFoundException({
        message: 'Notification not found',
        error: 'not_found',
      });
    }
    return n;
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const n = await this.getOne(userId, id);
    if (!n.readAt) {
      n.readAt = new Date();
      await this.notificationRepo.save(n);
    }
    return n;
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: new Date() })
      .where('userId = :uid AND readAt IS NULL', { uid: userId })
      .execute();
    return { updated: result.affected ?? 0 };
  }

  async create(
    userId: string,
    type: NotificationType,
    postId?: string,
    channel = 'email',
  ): Promise<Notification> {
    const n = this.notificationRepo.create({
      userId,
      type,
      postId: postId ?? null,
      channel,
    });
    return this.notificationRepo.save(n);
  }
}
