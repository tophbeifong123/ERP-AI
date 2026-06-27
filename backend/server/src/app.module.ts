import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { appConfig, databaseConfig, redisConfig, s3Config, mailConfig } from './config';
import * as entities from './database/entities';
import { FilesModule } from './modules/files/files.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { ServicesModule } from './modules/services/services.module';
import { FacebookModule } from './modules/facebook/facebook.module';
import { EmailModule } from './modules/email/email.module';
import { AiModule } from './modules/ai/ai.module';
import { PostsModule } from './modules/posts/posts.module';
import { ContentPlansModule } from './modules/content-plans/content-plans.module';
import { AiJobsModule } from './modules/ai-jobs/ai-jobs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { RedisModule } from './common/redis/redis.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, s3Config, mailConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.user'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        entities: Object.values(entities),
        synchronize: false,
        logging: config.get<string>('app.nodeEnv') === 'development',
      }),
    }),
    TypeOrmModule.forFeature(Object.values(entities)),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
        },
      }),
    }),
    RedisModule,
    CommonModule,
    EmailModule,
    AuthModule,
    UsersModule,
    BusinessesModule,
    ServicesModule,
    FacebookModule,
    FilesModule,
    HealthModule,
    AiModule,
    PostsModule,
    ContentPlansModule,
    AiJobsModule,
    NotificationsModule,
    SchedulerModule,
    JobsModule,
  ],
  providers: [],
  exports: [],
})
export class AppModule {}
