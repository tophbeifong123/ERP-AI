import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Service } from '../../database/entities/service.entity';
import { Business } from '../../database/entities/business.entity';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import { FilesService } from '../files/files.service';
import { FileKind } from '../../database/entities/file.entity';

export interface PaginatedServices {
  services: Service[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service) private serviceRepo: Repository<Service>,
    @InjectRepository(Business) private businessRepo: Repository<Business>,
    private filesService: FilesService,
  ) {}

  async create(
    businessId: string,
    ownerId: string,
    dto: CreateServiceDto,
    image?: Express.Multer.File,
  ): Promise<Service> {
    const business = await this.businessRepo.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });
    if (!business) {
      throw new NotFoundException({
        message: 'Business not found',
        error: 'not_found',
      });
    }
    if (business.ownerId !== ownerId) {
      throw new NotFoundException({
        message: 'Business not found',
        error: 'not_found',
      });
    }

    let imageFileId: string | null = null;
    if (image) {
      const saved = await this.filesService.uploadFile(
        ownerId,
        'service_image',
        image.buffer,
        image.mimetype,
        image.originalname,
      );
      imageFileId = saved.id;
    }

    const service = this.serviceRepo.create({
      businessId,
      name: dto.name,
      description: dto.description ?? null,
      priceMinor: dto.price * 100,
      currency: dto.currency ?? 'THB',
      imageFileId,
    });
    const saved = await this.serviceRepo.save(service);
    return this.getOne(saved.id);
  }

  async listForBusiness(
    businessId: string,
    opts: { active?: boolean; page: number; limit: number },
  ): Promise<PaginatedServices> {
    const where: Record<string, unknown> = { businessId, deletedAt: IsNull() };
    if (opts.active !== undefined) where.isActive = opts.active;
    const [services, total] = await this.serviceRepo.findAndCount({
      where,
      relations: { image: true },
      order: { createdAt: 'DESC' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    });
    return { services, total, page: opts.page, limit: opts.limit };
  }

  async getOne(id: string): Promise<Service> {
    const service = await this.serviceRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { image: true },
    });
    if (!service) {
      throw new NotFoundException({
        message: 'Service not found',
        error: 'not_found',
      });
    }
    return service;
  }

  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    const service = await this.getOne(id);
    if (dto.name !== undefined) service.name = dto.name;
    if (dto.description !== undefined) service.description = dto.description;
    if (dto.price !== undefined) service.priceMinor = dto.price * 100;
    if (dto.currency !== undefined) service.currency = dto.currency;
    if (dto.isActive !== undefined) service.isActive = dto.isActive;
    await this.serviceRepo.save(service);
    return this.getOne(id);
  }

  async softDelete(id: string): Promise<void> {
    const service = await this.getOne(id);
    await this.serviceRepo.softDelete(service.id);
  }
}
