import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { StreamingService } from '../../services/streaming.service';
import { CircuitBreakerManager } from '../utils/circuit-breaker';

export interface ShutdownHandler {
  name: string;
  handler: () => Promise<void>;
  timeout?: number;
  priority?: number; // Lower numbers = higher priority
}

@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);
  private readonly shutdownHandlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private readonly defaultTimeout = 30000; // 30 seconds

  constructor(
    private readonly streamingService?: StreamingService,
  ) {
    this.registerDefaultHandlers();
    this.setupSignalHandlers();
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('⚠️ Shutdown already in progress, ignoring additional signal');
      return;
    }

    this.isShuttingDown = true;
    this.logger.log(`🛑 Graceful shutdown initiated (signal: ${signal || 'unknown'})`);

    try {
      await this.executeShutdownSequence();
      this.logger.log('✅ Graceful shutdown completed successfully');
    } catch (error) {
      this.logger.error('❌ Error during graceful shutdown:', error);
      throw error;
    }
  }

  registerHandler(handler: ShutdownHandler): void {
    this.shutdownHandlers.push(handler);
    this.shutdownHandlers.sort((a, b) => (a.priority || 50) - (b.priority || 50));
    this.logger.debug(`📝 Registered shutdown handler: ${handler.name} (priority: ${handler.priority || 50})`);
  }

  private async executeShutdownSequence(): Promise<void> {
    const startTime = Date.now();
    
    // Execute handlers in priority order
    for (const handler of this.shutdownHandlers) {
      try {
        const handlerTimeout = handler.timeout || this.defaultTimeout;
        this.logger.log(`🔄 Executing shutdown handler: ${handler.name} (timeout: ${handlerTimeout}ms)`);
        
        await Promise.race([
          handler.handler(),
          this.createTimeoutPromise(handlerTimeout, handler.name)
        ]);
        
        this.logger.log(`✅ Shutdown handler completed: ${handler.name}`);
      } catch (error) {
        this.logger.error(`❌ Shutdown handler failed: ${handler.name}`, error);
        // Continue with other handlers even if one fails
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(`🏁 Shutdown sequence completed in ${duration}ms`);
  }

  private createTimeoutPromise(timeout: number, handlerName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Shutdown handler '${handlerName}' timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  private registerDefaultHandlers(): void {
    // Stop accepting new streaming requests
    this.registerHandler({
      name: 'stop-new-streaming-requests',
      priority: 1,
      timeout: 5000,
      handler: async () => {
        this.logger.log('🚫 Stopping new streaming requests');
        // Implementation would mark service as shutting down
      },
    });

    // Wait for active streaming sessions to complete
    this.registerHandler({
      name: 'complete-active-streams',
      priority: 10,
      timeout: 60000, // Give streaming sessions time to complete
      handler: async () => {
        if (!this.streamingService) return;
        
        const activeSessions = this.streamingService.getActiveSessions();
        if (activeSessions.length === 0) {
          this.logger.log('✅ No active streaming sessions to wait for');
          return;
        }

        this.logger.log(`⏳ Waiting for ${activeSessions.length} active streaming sessions to complete`);
        
        // Wait for sessions to complete with timeout
        const maxWaitTime = 45000; // 45 seconds
        const checkInterval = 1000; // 1 second
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
          const currentSessions = this.streamingService.getActiveSessions();
          if (currentSessions.length === 0) {
            this.logger.log('✅ All streaming sessions completed');
            return;
          }
          
          this.logger.debug(`⏳ Still waiting for ${currentSessions.length} streaming sessions...`);
          await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        
        // Force cancel remaining sessions
        const remainingSessions = this.streamingService.getActiveSessions();
        this.logger.warn(`⚠️ Force cancelling ${remainingSessions.length} remaining streaming sessions`);
        
        for (const sessionId of remainingSessions) {
          this.streamingService.cancelStream(sessionId);
        }
      },
    });

    // Close database connections
    this.registerHandler({
      name: 'close-database-connections',
      priority: 20,
      timeout: 10000,
      handler: async () => {
        this.logger.log('🔌 Closing database connections');
        // Implementation would close MongoDB connections
      },
    });

    // Close Redis connections
    this.registerHandler({
      name: 'close-redis-connections',
      priority: 20,
      timeout: 5000,
      handler: async () => {
        this.logger.log('🔌 Closing Redis connections');
        // Implementation would close Redis connections
      },
    });

    // Reset circuit breakers
    this.registerHandler({
      name: 'reset-circuit-breakers',
      priority: 30,
      timeout: 5000,
      handler: async () => {
        this.logger.log('🔄 Resetting circuit breakers');
        CircuitBreakerManager.resetAll();
      },
    });

    // Cleanup temporary files and resources
    this.registerHandler({
      name: 'cleanup-resources',
      priority: 40,
      timeout: 10000,
      handler: async () => {
        this.logger.log('🧹 Cleaning up temporary resources');
        // Implementation would cleanup temp files, caches, etc.
      },
    });

    // Final logging and metrics
    this.registerHandler({
      name: 'final-logging',
      priority: 50,
      timeout: 2000,
      handler: async () => {
        this.logger.log('📊 Sending final metrics and logs');
        // Implementation would flush logs and metrics
      },
    });
  }

  private setupSignalHandlers(): void {
    // Handle different shutdown signals
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'] as const;
    
    for (const signal of signals) {
      process.on(signal, async () => {
        this.logger.log(`📡 Received ${signal} signal`);
        await this.onApplicationShutdown(signal);
        process.exit(0);
      });
    }

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      this.logger.error('💥 Uncaught exception:', error);
      await this.onApplicationShutdown('uncaughtException');
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason) => {
      this.logger.error('💥 Unhandled promise rejection:', reason);
      await this.onApplicationShutdown('unhandledRejection');
      process.exit(1);
    });
  }

  // Health check method
  isHealthy(): boolean {
    return !this.isShuttingDown;
  }

  // Get shutdown status
  getShutdownStatus(): {
    isShuttingDown: boolean;
    handlersRegistered: number;
    handlersCompleted: number;
  } {
    return {
      isShuttingDown: this.isShuttingDown,
      handlersRegistered: this.shutdownHandlers.length,
      handlersCompleted: 0, // This would need to be tracked during execution
    };
  }
} 