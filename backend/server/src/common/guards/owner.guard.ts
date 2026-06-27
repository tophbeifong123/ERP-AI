import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RESOURCE_TYPE_KEY } from '../decorators/resource-type.decorator';

@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { id?: string } | undefined;
    if (!user?.id) {
      throw new ForbiddenException('not_authenticated');
    }

    const resourceType = this.reflector.getAllAndOverride<string>(RESOURCE_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!resourceType) {
      return true;
    }

    const resourceId =
      request.params?.id ||
      request.params?.businessId ||
      request.params?.serviceId ||
      request.params?.pageId;
    if (!resourceId) {
      return true;
    }

    const ownerId = await this.resolveOwnerId(resourceType, resourceId);
    if (!ownerId || ownerId !== user.id) {
      throw new ForbiddenException('not_owner');
    }
    return true;
  }

  private async resolveOwnerId(resourceType: string, resourceId: string): Promise<string | null> {
    switch (resourceType) {
      case 'business': {
        const row = await this.dataSource.query(
          'SELECT owner_id FROM businesses WHERE id = $1 AND deleted_at IS NULL',
          [resourceId],
        );
        return row[0]?.owner_id ?? null;
      }
      case 'service': {
        const row = await this.dataSource.query(
          'SELECT b.owner_id FROM services s JOIN businesses b ON b.id = s.business_id WHERE s.id = $1 AND s.deleted_at IS NULL',
          [resourceId],
        );
        return row[0]?.owner_id ?? null;
      }
      case 'post': {
        const row = await this.dataSource.query(
          'SELECT b.owner_id FROM posts p JOIN businesses b ON b.id = p.business_id WHERE p.id = $1',
          [resourceId],
        );
        return row[0]?.owner_id ?? null;
      }
      case 'facebook-page': {
        const row = await this.dataSource.query(
          'SELECT b.owner_id FROM facebook_pages fp JOIN businesses b ON b.id = fp.business_id WHERE fp.id = $1 AND fp.deleted_at IS NULL',
          [resourceId],
        );
        return row[0]?.owner_id ?? null;
      }
      case 'content-plan': {
        const row = await this.dataSource.query(
          'SELECT b.owner_id FROM content_plans cp JOIN businesses b ON b.id = cp.business_id WHERE cp.id = $1',
          [resourceId],
        );
        return row[0]?.owner_id ?? null;
      }
      default:
        return null;
    }
  }
}
