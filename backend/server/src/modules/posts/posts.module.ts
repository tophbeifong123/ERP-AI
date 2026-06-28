import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Post } from '../../database/entities/post.entity';
import { PostMedia } from '../../database/entities/post-media.entity';
import { PostFeaturedService } from '../../database/entities/post-featured-service.entity';
import { Business } from '../../database/entities/business.entity';
import { User } from '../../database/entities/user.entity';
import { AiJob } from '../../database/entities/ai-job.entity';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { AuthConfigModule } from '../auth/auth-config.module';
import { PostEventsModule } from './post-events.module';

const queueFactory = (config: ConfigService) => ({
  connection: {
    host: config.get<string>('redis.host'),
    port: config.get<number>('redis.port'),
  },
});

@Module({
  imports: [
    AuthConfigModule,
    TypeOrmModule.forFeature([
      Post,
      PostMedia,
      PostFeaturedService,
      Business,
      User,
      AiJob,
    ]),
    BullModule.registerQueueAsync({
      name: 'caption',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: queueFactory,
    }),
    BullModule.registerQueueAsync({
      name: 'media',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: queueFactory,
    }),
    PostEventsModule,
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService, PostEventsModule],
})
export class PostsModule {}
