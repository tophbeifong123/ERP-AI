import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { File, FileKind } from '../../database/entities/file.entity';
import { S3Service, PresignedUploadResult } from './s3.service';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(File)
    private fileRepo: Repository<File>,
    private s3Service: S3Service,
  ) {}

  async uploadFile(
    ownerId: string,
    kind: FileKind,
    buffer: Buffer,
    contentType: string,
    originalName?: string,
  ): Promise<File> {
    const prefix = this.getPrefix(kind);
    const result = await this.s3Service.uploadFile(
      buffer,
      `${prefix}/${Date.now()}-${originalName || 'file'}`,
      contentType,
    );

    const file = this.fileRepo.create({
      ownerId,
      kind,
      storageKey: result.storageKey,
      mime: result.mime,
      sizeBytes: result.sizeBytes,
      publicUrl: result.publicUrl,
    });

    return this.fileRepo.save(file);
  }

  async generatePresignedUpload(
    kind: FileKind,
    contentType: string,
    expiresIn = 300,
  ): Promise<PresignedUploadResult> {
    const prefix = this.getPrefix(kind);
    return this.s3Service.generatePresignedUploadUrl(
      prefix,
      contentType,
      expiresIn,
    );
  }

  async savePresignedUpload(
    ownerId: string,
    kind: FileKind,
    storageKey: string,
    publicUrl: string,
    contentType: string,
    sizeBytes: number,
  ): Promise<File> {
    const file = this.fileRepo.create({
      ownerId,
      kind,
      storageKey,
      mime: contentType,
      sizeBytes,
      publicUrl,
    });

    return this.fileRepo.save(file);
  }

  async findById(id: string): Promise<File | null> {
    return this.fileRepo.findOne({ where: { id } });
  }

  async deleteFile(id: string): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id } });
    if (!file) {
      throw new BadRequestException('File not found');
    }

    await this.s3Service.deleteFile(file.storageKey);
    await this.fileRepo.softDelete(id);
  }

  private getPrefix(kind: FileKind): string {
    const prefixes: Record<FileKind, string> = {
      logo: 'logos',
      service_image: 'services',
      post_media: 'posts/media',
    };
    return prefixes[kind];
  }
}
