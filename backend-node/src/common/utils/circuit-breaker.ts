import { Logger } from '@nestjs/common';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeout?: number;
  monitoringPeriod?: number;
  expectedErrors?: string[];
  onStateChange?: (from: CircuitBreakerState, to: CircuitBreakerState) => void;
  onFailure?: (error: any) => void;
  onSuccess?: () => void;
}

interface CircuitBreakerStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastFailureTime?: number;
  consecutiveFailures: number;
}

export class CircuitBreaker {
  private readonly logger = new Logger(CircuitBreaker.name);
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private stats: CircuitBreakerStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    consecutiveFailures: 0,
  };
  
  private nextAttempt: number = 0;
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.options = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 10000, // 10 seconds
      expectedErrors: ['TimeoutError', 'NetworkError', 'ECONNRESET', 'ENOTFOUND'],
      onStateChange: () => {},
      onFailure: () => {},
      onSuccess: () => {},
      ...options,
    };
    
    this.logger.log(`🔧 Circuit breaker '${this.name}' initialized`);
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.stats.totalRequests++;
    
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.setState(CircuitBreakerState.HALF_OPEN);
      } else {
        throw new Error(`Circuit breaker '${this.name}' is OPEN. Next attempt allowed at ${new Date(this.nextAttempt).toISOString()}`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onError(error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.stats.successfulRequests++;
    this.stats.consecutiveFailures = 0;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.setState(CircuitBreakerState.CLOSED);
      this.logger.log(`✅ Circuit breaker '${this.name}' recovered and closed`);
    }
    
    this.options.onSuccess();
  }

  private onError(error: any): void {
    this.stats.failedRequests++;
    this.stats.lastFailureTime = Date.now();
    
    // Check if this is an expected error that should trigger circuit breaker
    if (this.isExpectedError(error)) {
      this.stats.consecutiveFailures++;
      
      if (this.state === CircuitBreakerState.HALF_OPEN) {
        // If we're in HALF_OPEN and get an error, go back to OPEN
        this.setState(CircuitBreakerState.OPEN);
        this.scheduleNextAttempt();
      } else if (this.state === CircuitBreakerState.CLOSED && 
                 this.stats.consecutiveFailures >= this.options.failureThreshold) {
        // If we're CLOSED and hit failure threshold, open the circuit
        this.setState(CircuitBreakerState.OPEN);
        this.scheduleNextAttempt();
      }
    }
    
    this.options.onFailure(error);
  }

  private isExpectedError(error: any): boolean {
    if (!error) return false;
    
    const errorIdentifiers = [
      error.name,
      error.code,
      error.constructor?.name,
    ].filter(Boolean);
    
    return this.options.expectedErrors.some(expectedError =>
      errorIdentifiers.includes(expectedError) ||
      (error.message && error.message.includes(expectedError))
    );
  }

  private shouldAttemptReset(): boolean {
    return Date.now() >= this.nextAttempt;
  }

  private scheduleNextAttempt(): void {
    this.nextAttempt = Date.now() + this.options.recoveryTimeout;
  }

  private setState(newState: CircuitBreakerState): void {
    const oldState = this.state;
    if (oldState !== newState) {
      this.state = newState;
      this.logger.log(`🔄 Circuit breaker '${this.name}' state changed: ${oldState} -> ${newState}`);
      this.options.onStateChange(oldState, newState);
    }
  }

  // Public methods for monitoring
  getState(): CircuitBreakerState {
    return this.state;
  }

  getStats(): CircuitBreakerStats & { 
    failureRate: number;
    uptime: number;
    isHealthy: boolean;
  } {
    const failureRate = this.stats.totalRequests > 0 
      ? this.stats.failedRequests / this.stats.totalRequests 
      : 0;
    
    const uptime = this.state === CircuitBreakerState.CLOSED ? 100 : 0;
    const isHealthy = this.state === CircuitBreakerState.CLOSED && failureRate < 0.1;
    
    return {
      ...this.stats,
      failureRate: Math.round(failureRate * 100) / 100,
      uptime,
      isHealthy,
    };
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      consecutiveFailures: 0,
    };
    this.nextAttempt = 0;
    this.logger.log(`🔄 Circuit breaker '${this.name}' manually reset`);
  }

  forceOpen(): void {
    this.setState(CircuitBreakerState.OPEN);
    this.scheduleNextAttempt();
    this.logger.warn(`🚨 Circuit breaker '${this.name}' manually opened`);
  }

  forceClose(): void {
    this.setState(CircuitBreakerState.CLOSED);
    this.stats.consecutiveFailures = 0;
    this.nextAttempt = 0;
    this.logger.log(`🔧 Circuit breaker '${this.name}' manually closed`);
  }
}

// Decorator for easy circuit breaker usage
export function CircuitBreak(options: CircuitBreakerOptions & { name: string }) {
  const circuitBreaker = new CircuitBreaker(options.name, options);
  
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return circuitBreaker.execute(() => method.apply(this, args));
    };
    
    // Add circuit breaker reference to the target for monitoring
    if (!target.constructor.circuitBreakers) {
      target.constructor.circuitBreakers = new Map();
    }
    target.constructor.circuitBreakers.set(propertyName, circuitBreaker);
    
    return descriptor;
  };
}

// Circuit breaker manager for global monitoring
export class CircuitBreakerManager {
  private static breakers = new Map<string, CircuitBreaker>();
  private static readonly logger = new Logger(CircuitBreakerManager.name);

  static register(name: string, breaker: CircuitBreaker): void {
    this.breakers.set(name, breaker);
    this.logger.log(`📋 Registered circuit breaker: ${name}`);
  }

  static unregister(name: string): void {
    this.breakers.delete(name);
    this.logger.log(`📋 Unregistered circuit breaker: ${name}`);
  }

  static get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  static getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  static getHealthStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [name, breaker] of this.breakers) {
      status[name] = {
        state: breaker.getState(),
        stats: breaker.getStats(),
      };
    }
    
    return status;
  }

  static resetAll(): void {
    for (const [name, breaker] of this.breakers) {
      breaker.reset();
    }
    this.logger.log(`🔄 Reset all circuit breakers`);
  }
} 