import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiJob } from '../../database/entities/ai-job.entity';
import { AiJobsService } from './ai-jobs.service';
import { AiJobsController } from './ai-jobs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AiJob])],
  controllers: [AiJobsController],
  providers: [AiJobsService],
  exports: [AiJobsService],
})
export class AiJobsModule {}
