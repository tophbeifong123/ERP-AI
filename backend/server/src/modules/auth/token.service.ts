import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface RefreshTokenPayload {
  sub: string;
  email: string;
  jti: string;
}

export interface DecodedRefreshToken extends RefreshTokenPayload {
  iat: number;
  exp: number;
}

@Injectable()
export class TokenService {
  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  signAccessToken(user: { id: string; email: string }): string {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('app.jwt.accessSecret'),
      expiresIn: this.configService.get<number>('app.jwt.accessTtl'),
    });
  }

  signRefreshToken(user: { id: string; email: string }, jti: string): string {
    const payload: RefreshTokenPayload = {
      sub: user.id,
      email: user.email,
      jti,
    };
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('app.jwt.refreshSecret'),
      expiresIn: this.configService.get<number>('app.jwt.refreshTtl'),
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return this.jwtService.verify<AccessTokenPayload>(token, {
        secret: this.configService.get<string>('app.jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  verifyRefreshToken(token: string): DecodedRefreshToken {
    try {
      return this.jwtService.verify<DecodedRefreshToken>(token, {
        secret: this.configService.get<string>('app.jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  get refreshTtlSeconds(): number {
    return this.configService.get<number>('app.jwt.refreshTtl') ?? 604800;
  }
}
