import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from '../../database/entities/service.entity';
import { Business } from '../../database/entities/business.entity';
import { File } from '../../database/entities/file.entity';
import { User } from '../../database/entities/user.entity';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { AuthConfigModule } from '../auth/auth-config.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    AuthConfigModule,
    FilesModule,
    TypeOrmModule.forFeature([Service, Business, File, User]),
  ],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
