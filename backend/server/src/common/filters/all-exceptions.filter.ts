import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'internal_error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;
        error = (resp.error as string) || error;
        details = resp.details;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error({ err: exception, path: request.path }, 'Unhandled exception');
    }

    const responseBody: Record<string, unknown> = {
      statusCode: status,
      error,
      message,
    };

    if (details) {
      responseBody.details = details;
    }

    if (request.reqId) {
      responseBody.reqId = request.reqId;
    }

    response.status(status).json(responseBody);
  }
}
