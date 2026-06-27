import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AiJobsService } from './ai-jobs.service';
import { AiJobStatus, AiJobType } from '../../database/entities/ai-job.entity';

@Controller('ai-jobs')
export class AiJobsController {
  constructor(private aiJobsService: AiJobsService) {}

  @Get()
  async list(
    @Query('type') type?: AiJobType,
    @Query('status') status?: AiJobStatus,
    @Query('postId') postId?: string,
  ) {
    const jobs = await this.aiJobsService.list({ type, status, postId });
    return { jobs };
  }

  @Get(':id')
  async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const job = await this.aiJobsService.getOne(id);
    return { job };
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  async retry(@Param('id', new ParseUUIDPipe()) id: string) {
    const job = await this.aiJobsService.retry(id);
    return { job };
  }
}
