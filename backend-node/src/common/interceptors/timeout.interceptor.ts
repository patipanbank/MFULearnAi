import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
  Logger,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

export interface TimeoutOptions {
  timeout?: number;
  message?: string;
  excludePaths?: string[];
  dynamicTimeout?: (context: ExecutionContext) => number;
}

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimeoutInterceptor.name);
  private readonly defaultTimeout = 30000; // 30 seconds

  constructor(private readonly options: TimeoutOptions = {}) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const path = request.url;
    
    // Check if this path should be excluded from timeout
    if (this.options.excludePaths?.some(excludePath => path.includes(excludePath))) {
      return next.handle();
    }

    // Determine timeout value
    const timeoutValue = this.getTimeoutValue(context);
    
    // Add timeout metadata to request for logging
    request.timeoutStart = Date.now();
    request.timeoutValue = timeoutValue;

    return next.handle().pipe(
      timeout(timeoutValue),
      catchError((error) => {
        if (error instanceof TimeoutError) {
          const duration = Date.now() - request.timeoutStart;
          const timeoutMessage = this.options.message || 
            `Request timeout after ${timeoutValue}ms (actual: ${duration}ms)`;
          
          this.logger.warn(
            `⏰ Request timeout: ${request.method} ${path} - ${timeoutMessage}`,
            {
              method: request.method,
              path,
              timeout: timeoutValue,
              duration,
              userAgent: request.headers['user-agent'],
              ip: request.ip,
            }
          );

          return throwError(() => new RequestTimeoutException(timeoutMessage));
        }
        
        return throwError(() => error);
      }),
    );
  }

  private getTimeoutValue(context: ExecutionContext): number {
    if (this.options.dynamicTimeout) {
      return this.options.dynamicTimeout(context);
    }
    
    return this.options.timeout || this.defaultTimeout;
  }
}

// Predefined timeout configurations
export const ShortTimeout = () => new TimeoutInterceptor({ 
  timeout: 5000,
  message: 'Request timeout - operation took too long'
});

export const MediumTimeout = () => new TimeoutInterceptor({ 
  timeout: 15000,
  message: 'Request timeout - please try again'
});

export const LongTimeout = () => new TimeoutInterceptor({ 
  timeout: 60000,
  message: 'Request timeout - operation timed out'
});

export const StreamingTimeout = () => new TimeoutInterceptor({
  timeout: 300000, // 5 minutes for streaming operations
  message: 'Streaming operation timeout',
  excludePaths: ['/health', '/metrics'],
});

export const DynamicTimeout = () => new TimeoutInterceptor({
  dynamicTimeout: (context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const path = request.url;
    
    // Different timeouts for different endpoints
    if (path.includes('/agents/execute-streaming')) {
      return 300000; // 5 minutes for AI streaming
    } else if (path.includes('/upload')) {
      return 120000; // 2 minutes for file uploads
    } else if (path.includes('/auth')) {
      return 10000; // 10 seconds for auth
    } else if (path.includes('/health')) {
      return 5000; // 5 seconds for health checks
    }
    
    return 30000; // Default 30 seconds
  },
});

// Timeout decorator for methods
export function Timeout(timeoutMs: number, message?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const logger = new Logger(`${target.constructor.name}.${propertyName}`);
    
    descriptor.value = async function (...args: any[]) {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new RequestTimeoutException(
            message || `Method '${propertyName}' timeout after ${timeoutMs}ms`
          ));
        }, timeoutMs);
      });

      const operationPromise = method.apply(this, args);
      
      try {
        const result = await Promise.race([operationPromise, timeoutPromise]);
        return result;
      } catch (error) {
        if (error instanceof RequestTimeoutException) {
          logger.warn(`⏰ Method timeout: ${propertyName} after ${timeoutMs}ms`);
        }
        throw error;
      }
    };
    
    return descriptor;
  };
} 