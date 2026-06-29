import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Post } from '../../database/entities/post.entity';
import { SchedulerService } from './scheduler.service';

const queueFactory = (config: ConfigService) => ({
  connection: {
    host: config.get<string>('redis.host'),
    port: config.get<number>('redis.port'),
  },
});

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Post]),
    BullModule.registerQueueAsync({
      name: 'dispatch-post',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: queueFactory,
    }),
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
