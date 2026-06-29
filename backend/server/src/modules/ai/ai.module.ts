import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Post } from '../../database/entities/post.entity';
import { PostMedia } from '../../database/entities/post-media.entity';
import { AiJob } from '../../database/entities/ai-job.entity';
import { Business } from '../../database/entities/business.entity';
import { Service } from '../../database/entities/service.entity';
import { File } from '../../database/entities/file.entity';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AuthConfigModule } from '../auth/auth-config.module';
import { PostEventsModule } from '../posts/post-events.module';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [
    AuthConfigModule,
    PostsModule,
    TypeOrmModule.forFeature([
      Post,
      PostMedia,
      AiJob,
      Business,
      Service,
      File,
    ]),
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
