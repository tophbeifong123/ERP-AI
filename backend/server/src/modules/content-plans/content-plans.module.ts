import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentPlan } from '../../database/entities/content-plan.entity';
import { Post } from '../../database/entities/post.entity';
import { Business } from '../../database/entities/business.entity';
import { User } from '../../database/entities/user.entity';
import { ContentPlansService } from './content-plans.service';
import { ContentPlansController } from './content-plans.controller';
import { AuthConfigModule } from '../auth/auth-config.module';

@Module({
  imports: [
    AuthConfigModule,
    TypeOrmModule.forFeature([ContentPlan, Post, Business, User]),
  ],
  controllers: [ContentPlansController],
  providers: [ContentPlansService],
  exports: [ContentPlansService],
})
export class ContentPlansModule {}
