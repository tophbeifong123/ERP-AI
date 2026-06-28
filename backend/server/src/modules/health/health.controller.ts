import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get()
  @Public()
  async check() {
    const result = await this.healthService.check();

    if (result.status === 'degraded') {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
