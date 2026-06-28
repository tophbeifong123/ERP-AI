import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacebookPage } from '../../database/entities/facebook-page.entity';
import { Business } from '../../database/entities/business.entity';
import { User } from '../../database/entities/user.entity';
import { FacebookService } from './facebook.service';
import { FacebookController } from './facebook.controller';
import { AuthConfigModule } from '../auth/auth-config.module';

@Module({
  imports: [AuthConfigModule, TypeOrmModule.forFeature([FacebookPage, Business, User])],
  controllers: [FacebookController],
  providers: [FacebookService],
  exports: [FacebookService],
})
export class FacebookModule {}
