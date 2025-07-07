import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ZodError } from 'zod';

@Catch(ZodError)
export class ZodErrorFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = HttpStatus.BAD_REQUEST;

    const errors = exception.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
      ...(('received' in err) && { received: err.received }),
    }));

    response.status(status).json({
      statusCode: status,
      message: 'Validation failed',
      errors,
      timestamp: new Date().toISOString(),
    });
  }
} 