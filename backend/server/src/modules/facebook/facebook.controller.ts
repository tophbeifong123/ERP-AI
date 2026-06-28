import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { FacebookService } from './facebook.service';
import { ConnectPageDto } from './dto/connect-page.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EmailVerifiedGuard } from '../../common/guards/email-verified.guard';
import { OwnerGuard } from '../../common/guards/owner.guard';
import { ResourceType } from '../../common/decorators/resource-type.decorator';

@Controller('facebook')
export class FacebookController {
  constructor(private facebookService: FacebookService) {}

  @Get('oauth/start')
  async start(
    @Query('businessId') businessId: string,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    if (!businessId) {
      return res
        .status(400)
        .json({ message: 'businessId is required', error: 'bad_request' });
    }
    const url = await this.facebookService.buildOAuthUrl(userId, businessId);
    return res.redirect(url);
  }

  @Public()
  @Get('oauth/callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    if (!code || !state) {
      return res.redirect(`${frontendUrl}/businesses?fb=missing_params`);
    }
    try {
      const { businessId } = await this.facebookService.handleCallback(
        code,
        state,
      );
      return res.redirect(
        `${frontendUrl}/businesses/${businessId}?fb=connected`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'callback_failed';
      return res.redirect(
        `${frontendUrl}/businesses?fb=error&msg=${encodeURIComponent(msg)}`,
      );
    }
  }

  @Get('pages')
  @UseGuards(EmailVerifiedGuard)
  async listPages(
    @Query('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentUser('id') userId: string,
  ) {
    const pages = await this.facebookService.listPagesForUser(
      userId,
      businessId,
    );
    return { pages };
  }

  @Post('businesses/:id/facebook-pages')
  @UseGuards(EmailVerifiedGuard, OwnerGuard)
  @ResourceType('business')
  @HttpCode(HttpStatus.CREATED)
  async connect(
    @Param('id', new ParseUUIDPipe()) businessId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ConnectPageDto,
  ) {
    const facebookPage = await this.facebookService.connectPage(
      userId,
      businessId,
      dto.fbPageId,
    );
    return { facebookPage };
  }

  @Delete('businesses/:id/facebook-pages/:pageId')
  @UseGuards(EmailVerifiedGuard, OwnerGuard)
  @ResourceType('business')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(
    @Param('id', new ParseUUIDPipe()) businessId: string,
    @Param('pageId', new ParseUUIDPipe()) pageId: string,
  ) {
    await this.facebookService.disconnectPage(businessId, pageId);
    return;
  }
}
