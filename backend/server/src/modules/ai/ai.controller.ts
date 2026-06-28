import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  AiService,
  CaptionDto,
  DecideDto,
  FailDto,
  ImageCallbackDto,
  ShortVideoCallbackDto,
} from './ai.service';
import { Public } from '../../common/decorators/public.decorator';
import { InternalTokenGuard } from '../../common/guards/internal-token.guard';
import { UseGuards } from '@nestjs/common';

@Controller('internal/ai')
@UseGuards(InternalTokenGuard)
export class AiController {
  constructor(private aiService: AiService) {}

  @Public()
  @Post('decide/callback')
  @HttpCode(HttpStatus.OK)
  async decideCallback(@Body() dto: DecideDto) {
    const plan = await this.aiService.decide(dto);
    return { plan };
  }

  @Public()
  @Post('caption/callback')
  @HttpCode(HttpStatus.OK)
  async captionCallback(@Body() dto: CaptionDto) {
    const post = await this.aiService.captionCallback(dto);
    return { post };
  }

  @Public()
  @Post('image/callback')
  @HttpCode(HttpStatus.OK)
  async imageCallback(@Body() dto: ImageCallbackDto) {
    const post = await this.aiService.imageCallback(dto);
    return { post };
  }

  @Public()
  @Post('short_video/callback')
  @HttpCode(HttpStatus.OK)
  async shortVideoCallback(@Body() dto: ShortVideoCallbackDto) {
    const post = await this.aiService.shortVideoCallback(dto);
    return { post };
  }

  @Public()
  @Post('job/fail')
  @HttpCode(HttpStatus.OK)
  async failJob(@Body() dto: FailDto) {
    const job = await this.aiService.fail(dto);
    return { job };
  }
}
