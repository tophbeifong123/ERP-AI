import {
  Controller,
  Post,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Post('upload/:kind')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async uploadFile(
    @CurrentUser('id') userId: string,
    @Param('kind') kind: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const validKinds = ['logo', 'service_image', 'post_media'];
    if (!validKinds.includes(kind)) {
      throw new BadRequestException('Invalid file kind');
    }

    const allowedMimes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'video/mp4',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type');
    }

    const result = await this.filesService.uploadFile(
      userId,
      kind as 'logo' | 'service_image' | 'post_media',
      file.buffer,
      file.mimetype,
      file.originalname,
    );

    return { file: result };
  }

  @Post('presigned/:kind')
  async getPresignedUrl(
    @CurrentUser('id') userId: string,
    @Param('kind') kind: string,
  ) {
    const validKinds = ['logo', 'service_image', 'post_media'];
    if (!validKinds.includes(kind)) {
      throw new BadRequestException('Invalid file kind');
    }

    const result = await this.filesService.generatePresignedUpload(
      kind as 'logo' | 'service_image' | 'post_media',
      'image/png',
    );

    return result;
  }
}
