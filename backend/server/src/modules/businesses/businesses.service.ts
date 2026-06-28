import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  Business,
  FixedScheduleRule,
} from '../../database/entities/business.entity';
import {
  CreateBusinessDto,
  UpdateAutoPostDto,
  UpdateBusinessDto,
} from './dto/business.dto';
import { FilesService } from '../files/files.service';
import { FileKind } from '../../database/entities/file.entity';

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business) private businessRepo: Repository<Business>,
    private filesService: FilesService,
  ) {}

  async create(
    ownerId: string,
    dto: CreateBusinessDto,
    logoFile?: Express.Multer.File,
  ): Promise<Business> {
    let logoFileId: string | null = null;
    if (logoFile) {
      const saved = await this.filesService.uploadFile(
        ownerId,
        'logo',
        logoFile.buffer,
        logoFile.mimetype,
        logoFile.originalname,
      );
      logoFileId = saved.id;
    }

    const business = this.businessRepo.create({
      ownerId,
      name: dto.name,
      industry: dto.industry,
      description: dto.description ?? null,
      targetAudience: dto.targetAudience ?? null,
      tone: dto.tone ?? null,
      keywords: dto.keywords ?? [],
      autoPostEnabled: dto.autoPost?.enabled ?? false,
      autoPostMode: dto.autoPost?.mode ?? null,
      postsPerWeekTarget: dto.autoPost?.postsPerWeekTarget ?? 3,
      minGapDays: dto.autoPost?.minGapDays ?? 1,
      fixedScheduleRules: dto.autoPost?.fixedScheduleRules ?? [],
      logoFileId,
    });
    return this.businessRepo.save(business);
  }

  async listForOwner(ownerId: string): Promise<Business[]> {
    return this.businessRepo.find({
      where: { ownerId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async getOne(id: string): Promise<Business> {
    const business = await this.businessRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!business) {
      throw new NotFoundException({
        message: 'Business not found',
        error: 'not_found',
      });
    }
    return business;
  }

  async update(id: string, dto: UpdateBusinessDto): Promise<Business> {
    const business = await this.getOne(id);
    Object.assign(business, {
      name: dto.name ?? business.name,
      industry: dto.industry ?? business.industry,
      description: dto.description ?? business.description,
      targetAudience: dto.targetAudience ?? business.targetAudience,
      tone: dto.tone ?? business.tone,
      keywords: dto.keywords ?? business.keywords,
    });
    return this.businessRepo.save(business);
  }

  async softDelete(id: string): Promise<void> {
    const business = await this.getOne(id);
    await this.businessRepo.softDelete(business.id);
  }

  async uploadLogo(
    businessId: string,
    ownerId: string,
    file: Express.Multer.File,
  ) {
    const business = await this.getOne(businessId);
    const saved = await this.filesService.uploadFile(
      ownerId,
      'logo',
      file.buffer,
      file.mimetype,
      file.originalname,
    );
    business.logoFileId = saved.id;
    await this.businessRepo.save(business);
    return saved;
  }

  async updateAutoPost(id: string, dto: UpdateAutoPostDto): Promise<Business> {
    const business = await this.getOne(id);
    business.autoPostEnabled = dto.enabled;
    business.autoPostMode = dto.mode;
    business.postsPerWeekTarget = dto.postsPerWeekTarget;
    business.minGapDays = dto.minGapDays;
    business.fixedScheduleRules = dto.fixedScheduleRules;
    return this.businessRepo.save(business);
  }
}
