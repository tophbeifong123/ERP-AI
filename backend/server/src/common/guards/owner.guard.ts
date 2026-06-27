import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../../database/entities/business.entity';
import { Post } from '../../database/entities/post.entity';
import { Service } from '../../database/entities/service.entity';

@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(Business)
    private businessRepo: Repository<Business>,
    @InjectRepository(Post)
    private postRepo: Repository<Post>,
    @InjectRepository(Service)
    private serviceRepo: Repository<Service>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const resourceType = this.reflector.get<string>('resourceType', context.getHandler());
    const resourceId = request.params.id || request.params.businessId;

    if (!resourceType || !resourceId) {
      return true;
    }

    let ownerId: string | null = null;

    switch (resourceType) {
      case 'business':
        const business = await this.businessRepo.findOne({ where: { id: resourceId } });
        ownerId = business?.ownerId || null;
        break;
      case 'post':
        const post = await this.postRepo.findOne({ where: { id: resourceId }, relations: ['business'] });
        ownerId = post?.business?.ownerId || null;
        break;
      case 'service':
        const service = await this.serviceRepo.findOne({ where: { id: resourceId }, relations: ['business'] });
        ownerId = service?.business?.ownerId || null;
        break;
    }

    if (!ownerId || ownerId !== user.id) {
      throw new ForbiddenException('Not authorized to access this resource');
    }

    return true;
  }
}
