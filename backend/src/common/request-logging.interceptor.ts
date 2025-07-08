import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RequestLogging');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    const startTime = Date.now();
    const { method, url, headers, body, query, params } = request;
    const userAgent = headers['user-agent'] || 'Unknown';
    const ip = this.getClientIp(request);
    const userId = (request as any).user?.id || 'Anonymous';

    // Log request
    this.logger.log(
      `📥 ${method} ${url} - User: ${userId} - IP: ${ip} - UA: ${userAgent.substring(0, 50)}...`
    );

    // Log request details in debug mode
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`Request Details:`, {
        method,
        url,
        headers: this.sanitizeHeaders(headers),
        body: this.sanitizeBody(body),
        query,
        params,
        userId,
        ip,
        userAgent
      });
    }

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;
        
        // Log successful response
        this.logger.log(
          `📤 ${method} ${url} - ${statusCode} - ${duration}ms - User: ${userId}`
        );

        // Log response details in debug mode
        if (process.env.NODE_ENV === 'development') {
          this.logger.debug(`Response Details:`, {
            statusCode,
            duration,
            contentLength: response.get('Content-Length') || 'Unknown',
            responseSize: data ? JSON.stringify(data).length : 0
          });
        }

        // Record metrics if performance service is available
        this.recordMetrics(request, response, duration, false);
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;
        
        // Log error response
        this.logger.error(
          `❌ ${method} ${url} - ${statusCode} - ${duration}ms - User: ${userId} - Error: ${error.message}`
        );

        // Log error details
        this.logger.debug(`Error Details:`, {
          statusCode,
          duration,
          error: error.message,
          stack: error.stack,
          userId,
          ip,
          url
        });

        // Record metrics for error
        this.recordMetrics(request, response, duration, true);
        
        throw error;
      })
    );
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'] as string;
    const ip = forwarded ? forwarded.split(',')[0] : request.ip;
    return ip || 'Unknown';
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token'
    ];
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    const sanitized = { ...body };
    
    // Remove sensitive fields
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'apiKey',
      'authorization'
    ];
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  private recordMetrics(request: Request, response: Response, duration: number, isError: boolean): void {
    try {
      // Try to get performance service from global if available
      const performanceService = (global as any).performanceService;
      if (performanceService && typeof performanceService.recordRequest === 'function') {
        performanceService.recordRequest(duration, isError);
      }
    } catch (error) {
      // Silently ignore if performance service is not available
    }
  }
} 