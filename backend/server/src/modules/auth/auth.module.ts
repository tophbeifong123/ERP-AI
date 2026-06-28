import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { User } from '../../database/entities/user.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { EmailVerification } from '../../database/entities/email-verification.entity';
import { PasswordReset } from '../../database/entities/password-reset.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GlobalJwtGuard } from './guards/global-jwt.guard';
import { EmailModule } from '../email/email.module';
import { AuthConfigModule } from './auth-config.module';

@Module({
  imports: [
    AuthConfigModule,
    EmailModule,
    TypeOrmModule.forFeature([User, RefreshToken, EmailVerification, PasswordReset]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: GlobalJwtGuard },
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
