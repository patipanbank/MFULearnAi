import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoffMultiplier?: number;
  maxDelay?: number;
  retryOn?: (error: any) => boolean;
  onRetry?: (error: any, attempt: number) => void;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delay: 1000,
  backoffMultiplier: 2,
  maxDelay: 10000,
  retryOn: (error: any) => {
    // Retry on network errors, timeouts, and 5xx errors
    return (
      error.code === 'ECONNRESET' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.name === 'TimeoutError' ||
      error.name === 'NetworkError' ||
      (error.status && error.status >= 500) ||
      (error.response && error.response.status >= 500)
    );
  },
};

export function Retry(options: RetryOptions = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const logger = new Logger(`${target.constructor.name}.${propertyName}`);
    
    descriptor.value = async function (...args: any[]) {
      const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
      let lastError: any;
      
      for (let attempt = 1; attempt <= opts.maxAttempts!; attempt++) {
        try {
          const result = await method.apply(this, args);
          
          // If successful and this wasn't the first attempt, log recovery
          if (attempt > 1) {
            logger.log(`✅ Method recovered after ${attempt} attempts`);
          }
          
          return result;
                 } catch (error: any) {
           lastError = error;
           
           // Check if we should retry this error
           if (!opts.retryOn!(error)) {
             logger.debug(`❌ Error not retryable: ${error.message}`);
             throw error;
           }
           
           // If this is the last attempt, throw the error
           if (attempt === opts.maxAttempts) {
             logger.error(`❌ Method failed after ${attempt} attempts: ${error.message}`);
             throw error;
           }
          
          // Calculate delay with exponential backoff
          const delay = Math.min(
            opts.delay! * Math.pow(opts.backoffMultiplier!, attempt - 1),
            opts.maxDelay!
          );
          
          // Log retry attempt
          logger.warn(`🔄 Retry attempt ${attempt}/${opts.maxAttempts} after ${delay}ms delay: ${error.message}`);
          
          // Call onRetry callback if provided
          if (opts.onRetry) {
            opts.onRetry(error, attempt);
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      throw lastError;
    };
    
    return descriptor;
  };
}

// Predefined retry configurations
export const NetworkRetry = () => Retry({
  maxAttempts: 3,
  delay: 1000,
  backoffMultiplier: 2,
  retryOn: (error: any) => {
    return (
      error.code === 'ECONNRESET' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.name === 'NetworkError'
    );
  },
});

export const DatabaseRetry = () => Retry({
  maxAttempts: 2,
  delay: 500,
  backoffMultiplier: 2,
  retryOn: (error: any) => {
    return (
      error.name === 'MongoNetworkError' ||
      error.name === 'MongoTimeoutError' ||
      error.code === 'ECONNRESET' ||
      (error.message && error.message.includes('connection'))
    );
  },
});

export const ExternalServiceRetry = () => Retry({
  maxAttempts: 3,
  delay: 2000,
  backoffMultiplier: 1.5,
  maxDelay: 10000,
  retryOn: (error: any) => {
    return (
      (error.status && error.status >= 500) ||
      (error.response && error.response.status >= 500) ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.name === 'TimeoutError'
    );
  },
}); 