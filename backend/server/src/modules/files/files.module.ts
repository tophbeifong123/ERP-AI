import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { File } from '../../database/entities/file.entity';
import { S3Service } from './s3.service';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

@Module({
  imports: [TypeOrmModule.forFeature([File])],
  controllers: [FilesController],
  providers: [S3Service, FilesService],
  exports: [S3Service, FilesService],
})
export class FilesModule {}
