import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Post } from '../../database/entities/post.entity';
import { PostMedia } from '../../database/entities/post-media.entity';
import { ContentPlan } from '../../database/entities/content-plan.entity';
import { AiJob } from '../../database/entities/ai-job.entity';
import { Business } from '../../database/entities/business.entity';
import { Service } from '../../database/entities/service.entity';
import { File } from '../../database/entities/file.entity';
import { User } from '../../database/entities/user.entity';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AuthConfigModule } from '../auth/auth-config.module';
import { PostEventsModule } from '../posts/post-events.module';

@Module({
  imports: [
    AuthConfigModule,
    TypeOrmModule.forFeature([Post, PostMedia, ContentPlan, AiJob, Business, Service, File, User]),
    BullModule.registerQueueAsync({
      name: 'ai',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
        },
      }),
    }),
    PostEventsModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService, BullModule],
})
export class AiModule {}
