import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AiJob } from '../../database/entities/ai-job.entity';
import { Post } from '../../database/entities/post.entity';
import { FacebookPage } from '../../database/entities/facebook-page.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { CaptionProcessor } from './caption.processor';
import { MediaProcessor } from './media.processor';
import { DispatchPostProcessor } from './dispatch-post.processor';
import { RefreshTokenProcessor } from './refresh-token.processor';
import { CommonModule } from '../../common/common.module';
import { PostsModule } from '../posts/posts.module';
import { AuthConfigModule } from '../auth/auth-config.module';

const queueFactory = (config: ConfigService) => ({
  connection: {
    host: config.get<string>('redis.host'),
    port: config.get<number>('redis.port'),
  },
});

@Module({
  imports: [
    AuthConfigModule,
    CommonModule,
    TypeOrmModule.forFeature([AiJob, Post, FacebookPage, RefreshToken]),
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
    BullModule.registerQueueAsync({
      name: 'dispatch-post',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: queueFactory,
    }),
    BullModule.registerQueueAsync({
      name: 'refresh-token-cleanup',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: queueFactory,
    }),
    PostsModule,
  ],
  providers: [
    CaptionProcessor,
    MediaProcessor,
    DispatchPostProcessor,
    RefreshTokenProcessor,
  ],
  exports: [BullModule],
})
export class JobsModule {}
