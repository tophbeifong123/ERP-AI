import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, path } = request;
    const reqId = request.reqId;
    const userId = (request.user as { id?: string } | undefined)?.id;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - now;
        const statusCode = response.statusCode;

        this.logger.log({
          reqId,
          method,
          path,
          statusCode,
          durationMs,
          userId,
        });
      }),
    );
  }
}
