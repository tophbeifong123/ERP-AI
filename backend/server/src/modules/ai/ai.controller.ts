import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  AiService,
  CaptionDto,
  DecideDto,
  FailDto,
  MediaCallbackDto,
} from './ai.service';
import { Public } from '../../common/decorators/public.decorator';
import { InternalTokenGuard } from '../../common/guards/internal-token.guard';
import { PostsService } from '../posts/posts.service';

@Controller('internal/ai')
@UseGuards(InternalTokenGuard)
export class AiController {
  constructor(
    private aiService: AiService,
    private postsService: PostsService,
  ) {}

  @Public()
  @Post('decision/callback')
  @HttpCode(HttpStatus.OK)
  async decisionCallback(@Body() dto: DecideDto) {
    const result = await this.aiService.decisionCallback(dto);
    await this.postsService.checkPostGenerationComplete(result.post.id);
    return { job: result.job, post: result.post };
  }

  @Public()
  @Post('caption/callback')
  @HttpCode(HttpStatus.OK)
  async captionCallback(@Body() dto: CaptionDto) {
    const post = await this.aiService.captionCallback(dto);
    await this.postsService.checkPostGenerationComplete(post.id);
    return { post };
  }

  @Public()
  @Post('image/callback')
  @HttpCode(HttpStatus.OK)
  async imageCallback(@Body() dto: MediaCallbackDto) {
    const result = await this.aiService.mediaCallback(dto);
    if (result.post) {
      await this.postsService.checkPostGenerationComplete(result.post.id);
    } else if (result.job.status === 'failed') {
      await this.postsService.checkPostGenerationComplete(result.job.postId);
    }
    return {
      job: result.job,
      post: result.post,
      file: result.file,
      postMedia: result.postMedia,
    };
  }

  @Public()
  @Post('short_video/callback')
  @HttpCode(HttpStatus.OK)
  async shortVideoCallback(@Body() dto: MediaCallbackDto) {
    const result = await this.aiService.mediaCallback(dto);
    if (result.post) {
      await this.postsService.checkPostGenerationComplete(result.post.id);
    } else if (result.job.status === 'failed') {
      await this.postsService.checkPostGenerationComplete(result.job.postId);
    }
    return {
      job: result.job,
      post: result.post,
      file: result.file,
      postMedia: result.postMedia,
    };
  }

  @Public()
  @Post('job/fail')
  @HttpCode(HttpStatus.OK)
  async failJob(@Body() dto: FailDto) {
    const job = await this.aiService.fail(dto);
    // If the failed job was for a post currently in 'generating', check if all jobs done
    if (job.status === 'failed') {
      await this.postsService.checkPostGenerationComplete(job.postId);
    }
    return { job };
  }
}
