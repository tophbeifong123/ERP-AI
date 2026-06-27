import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthConfigModule } from '../auth/auth-config.module';

@Module({
  imports: [AuthConfigModule, TypeOrmModule.forFeature([User, RefreshToken])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
