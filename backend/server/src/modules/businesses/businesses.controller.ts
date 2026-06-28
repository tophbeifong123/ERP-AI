import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BusinessesService } from './businesses.service';
import {
  CreateBusinessDto,
  UpdateAutoPostDto,
  UpdateBusinessDto,
} from './dto/business.dto';
import { OwnerGuard } from '../../common/guards/owner.guard';
import { EmailVerifiedGuard } from '../../common/guards/email-verified.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResourceType } from '../../common/decorators/resource-type.decorator';

@Controller('businesses')
@UseGuards(EmailVerifiedGuard)
export class BusinessesController {
  constructor(private businessesService: BusinessesService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('logo', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBusinessDto,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    const business = await this.businessesService.create(userId, dto, logo);
    return { business };
  }

  @Get()
  async list(@CurrentUser('id') userId: string) {
    const businesses = await this.businessesService.listForOwner(userId);
    return { businesses };
  }

  @Get(':id')
  @UseGuards(OwnerGuard)
  @ResourceType('business')
  async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const business = await this.businessesService.getOne(id);
    return { business };
  }

  @Patch(':id')
  @UseGuards(OwnerGuard)
  @ResourceType('business')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    const business = await this.businessesService.update(id, dto);
    return { business };
  }

  @Delete(':id')
  @UseGuards(OwnerGuard)
  @ResourceType('business')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.businessesService.softDelete(id);
    return;
  }

  @Post(':id/logo')
  @UseGuards(OwnerGuard)
  @ResourceType('business')
  @UseInterceptors(
    FileInterceptor('logo', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @HttpCode(HttpStatus.CREATED)
  async uploadLogo(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      return { file: null };
    }
    const saved = await this.businessesService.uploadLogo(id, userId, file);
    return { file: saved };
  }

  @Patch(':id/auto-post')
  @UseGuards(OwnerGuard)
  @ResourceType('business')
  async updateAutoPost(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAutoPostDto,
  ) {
    const business = await this.businessesService.updateAutoPost(id, dto);
    return { business };
  }
}
