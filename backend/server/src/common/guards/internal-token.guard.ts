import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-internal-token'];
    const expectedToken = this.configService.get<string>('app.internalApiKey');

    if (!token || token !== expectedToken) {
      throw new UnauthorizedException('Invalid internal token');
    }

    return true;
  }
}
