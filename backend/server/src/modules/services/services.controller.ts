import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import { OwnerGuard } from '../../common/guards/owner.guard';
import { EmailVerifiedGuard } from '../../common/guards/email-verified.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResourceType } from '../../common/decorators/resource-type.decorator';

@Controller()
@UseGuards(EmailVerifiedGuard)
export class ServicesController {
  constructor(private servicesService: ServicesService) {}

  @Post('businesses/:id/services')
  @UseGuards(OwnerGuard)
  @ResourceType('business')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('id', new ParseUUIDPipe()) businessId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateServiceDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const service = await this.servicesService.create(businessId, userId, dto, image);
    return { service };
  }

  @Get('businesses/:id/services')
  @UseGuards(OwnerGuard)
  @ResourceType('business')
  async list(
    @Param('id', new ParseUUIDPipe()) businessId: string,
    @Query('active') active?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    const result = await this.servicesService.listForBusiness(businessId, {
      active: active === undefined ? undefined : active === 'true',
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit)),
    });
    return result;
  }

  @Get('services/:id')
  @UseGuards(OwnerGuard)
  @ResourceType('service')
  async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const service = await this.servicesService.getOne(id);
    return { service };
  }

  @Patch('services/:id')
  @UseGuards(OwnerGuard)
  @ResourceType('service')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    const service = await this.servicesService.update(id, dto);
    return { service };
  }

  @Delete('services/:id')
  @UseGuards(OwnerGuard)
  @ResourceType('service')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.servicesService.softDelete(id);
    return;
  }
}
