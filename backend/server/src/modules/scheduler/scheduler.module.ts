import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Business } from '../../database/entities/business.entity';
import { Post } from '../../database/entities/post.entity';
import { ContentPlan } from '../../database/entities/content-plan.entity';
import { AiJob } from '../../database/entities/ai-job.entity';
import { FacebookPage } from '../../database/entities/facebook-page.entity';
import { SchedulerService } from './scheduler.service';
import { PostsModule } from '../posts/posts.module';

const queueFactory = (config: ConfigService) => ({
  connection: {
    host: config.get<string>('redis.host'),
    port: config.get<number>('redis.port'),
  },
});

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      Business,
      Post,
      ContentPlan,
      AiJob,
      FacebookPage,
    ]),
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
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
