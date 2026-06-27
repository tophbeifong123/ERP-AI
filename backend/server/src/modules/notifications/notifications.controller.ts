import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationType } from '../../database/entities/notification.entity';

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Query('type') type?: NotificationType,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const notifications = await this.notificationsService.list(userId, {
      type,
      unreadOnly: unreadOnly === 'true',
    });
    return { notifications };
  }

  @Get(':id')
  async getOne(@CurrentUser('id') userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    const n = await this.notificationsService.getOne(userId, id);
    return { notification: n };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(@CurrentUser('id') userId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    const n = await this.notificationsService.markRead(userId, id);
    return { notification: n };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }
}
