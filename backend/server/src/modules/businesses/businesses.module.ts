import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '../../database/entities/business.entity';
import { File } from '../../database/entities/file.entity';
import { User } from '../../database/entities/user.entity';
import { BusinessesService } from './businesses.service';
import { BusinessesController } from './businesses.controller';
import { AuthConfigModule } from '../auth/auth-config.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [AuthConfigModule, FilesModule, TypeOrmModule.forFeature([Business, File, User])],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
