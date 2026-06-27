import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './dto/password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const result = await this.authService.register(dto.email, dto.password, this.meta(req));
    return { user: result.user, message: 'verification email sent' };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto.email, dto.password, this.meta(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, this.meta(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
    return;
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'reset email sent' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'password reset' };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
    return { message: 'verified' };
  }

  @Get('verify-email')
  @Public()
  async verifyEmailLanding(
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    let ok = false;
    let message = 'Invalid or expired token';
    if (token) {
      try {
        await this.authService.verifyEmail(token);
        ok = true;
        message = 'Email verified successfully. You can close this tab.';
      } catch {
        ok = false;
      }
    }
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const dest = ok ? `${frontendUrl}/login?verified=1` : `${frontendUrl}/login?verify_error=1`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(this.landingHtml(ok ? 'Email verified' : 'Verification failed', message, dest));
  }

  @Get('reset-password')
  @Public()
  async resetPasswordLanding(
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const dest = token
      ? `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`
      : `${frontendUrl}/login?reset_error=missing_token`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(
      this.landingHtml(
        'Password reset',
        'Redirecting to the password reset form...',
        dest,
      ),
    );
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const refreshToken = (req.body as { refreshToken?: string })?.refreshToken;
    await this.authService.changePassword(userId, dto.oldPassword, dto.newPassword, refreshToken);
    return { message: 'password changed' };
  }

  private meta(req: Request) {
    return {
      userAgent: req.headers['user-agent'],
      ip: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || undefined,
    };
  }

  private landingHtml(title: string, message: string, redirectTo: string): string {
    const safeRedirect = redirectTo.replace(/"/g, '&quot;');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<meta http-equiv="refresh" content="2;url=${safeRedirect}">
<style>body{font-family:Arial,sans-serif;max-width:520px;margin:80px auto;padding:24px;color:#222;text-align:center}</style>
</head><body><h1>${title}</h1><p>${message}</p><p><a href="${safeRedirect}">Continue</a></p></body></html>`;
  }
}
