import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../../database/entities/post.entity';
import { Business } from '../../database/entities/business.entity';
import { User } from '../../database/entities/user.entity';
import { FacebookPage } from '../../database/entities/facebook-page.entity';
import { PostEventsService } from './post-events.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { FacebookModule } from '../facebook/facebook.module';
import { AuthConfigModule } from '../auth/auth-config.module';

@Module({
  imports: [
    AuthConfigModule,
    TypeOrmModule.forFeature([Post, Business, User, FacebookPage]),
    NotificationsModule,
    EmailModule,
    FacebookModule,
  ],
  providers: [PostEventsService],
  exports: [PostEventsService],
})
export class PostEventsModule {}
