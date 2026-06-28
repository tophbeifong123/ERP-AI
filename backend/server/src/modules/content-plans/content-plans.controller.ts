import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { OwnerGuard } from '../../common/guards/owner.guard';
import { EmailVerifiedGuard } from '../../common/guards/email-verified.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResourceType } from '../../common/decorators/resource-type.decorator';
import { ContentPlansService } from './content-plans.service';
import { ContentPlanStatus, DecidedBy } from '../../database/entities/content-plan.entity';

@Controller('content-plans')
@UseGuards(EmailVerifiedGuard)
export class ContentPlansController {
  constructor(private contentPlansService: ContentPlansService) {}

  @Get()
  async list(
    @Query('businessId') businessId?: string,
    @Query('status') status?: ContentPlanStatus,
    @Query('decidedBy') decidedBy?: DecidedBy,
  ) {
    const plans = await this.contentPlansService.list({ businessId, status, decidedBy });
    return { plans };
  }

  @Get(':id')
  async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const plan = await this.contentPlansService.getOne(id);
    return { plan };
  }

  @Post(':id/materialize')
  @UseGuards(OwnerGuard)
  @ResourceType('content-plan')
  @HttpCode(HttpStatus.OK)
  async materialize(@Param('id', new ParseUUIDPipe()) id: string) {
    const result = await this.contentPlansService.materialize(id);
    return result;
  }

  @Post(':id/cancel')
  @UseGuards(OwnerGuard)
  @ResourceType('content-plan')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id', new ParseUUIDPipe()) id: string) {
    const plan = await this.contentPlansService.cancel(id);
    return { plan };
  }
}
