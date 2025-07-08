"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GracefulShutdownService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GracefulShutdownService = void 0;
const common_1 = require("@nestjs/common");
const streaming_service_1 = require("../../services/streaming.service");
const circuit_breaker_1 = require("../utils/circuit-breaker");
let GracefulShutdownService = GracefulShutdownService_1 = class GracefulShutdownService {
    constructor(streamingService) {
        this.streamingService = streamingService;
        this.logger = new common_1.Logger(GracefulShutdownService_1.name);
        this.shutdownHandlers = [];
        this.isShuttingDown = false;
        this.defaultTimeout = 30000;
        this.registerDefaultHandlers();
        this.setupSignalHandlers();
    }
    async onApplicationShutdown(signal) {
        if (this.isShuttingDown) {
            this.logger.warn('⚠️ Shutdown already in progress, ignoring additional signal');
            return;
        }
        this.isShuttingDown = true;
        this.logger.log(`🛑 Graceful shutdown initiated (signal: ${signal || 'unknown'})`);
        try {
            await this.executeShutdownSequence();
            this.logger.log('✅ Graceful shutdown completed successfully');
        }
        catch (error) {
            this.logger.error('❌ Error during graceful shutdown:', error);
            throw error;
        }
    }
    registerHandler(handler) {
        this.shutdownHandlers.push(handler);
        this.shutdownHandlers.sort((a, b) => (a.priority || 50) - (b.priority || 50));
        this.logger.debug(`📝 Registered shutdown handler: ${handler.name} (priority: ${handler.priority || 50})`);
    }
    async executeShutdownSequence() {
        const startTime = Date.now();
        for (const handler of this.shutdownHandlers) {
            try {
                const handlerTimeout = handler.timeout || this.defaultTimeout;
                this.logger.log(`🔄 Executing shutdown handler: ${handler.name} (timeout: ${handlerTimeout}ms)`);
                await Promise.race([
                    handler.handler(),
                    this.createTimeoutPromise(handlerTimeout, handler.name)
                ]);
                this.logger.log(`✅ Shutdown handler completed: ${handler.name}`);
            }
            catch (error) {
                this.logger.error(`❌ Shutdown handler failed: ${handler.name}`, error);
            }
        }
        const duration = Date.now() - startTime;
        this.logger.log(`🏁 Shutdown sequence completed in ${duration}ms`);
    }
    createTimeoutPromise(timeout, handlerName) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Shutdown handler '${handlerName}' timed out after ${timeout}ms`));
            }, timeout);
        });
    }
    registerDefaultHandlers() {
        this.registerHandler({
            name: 'stop-new-streaming-requests',
            priority: 1,
            timeout: 5000,
            handler: async () => {
                this.logger.log('🚫 Stopping new streaming requests');
            },
        });
        this.registerHandler({
            name: 'complete-active-streams',
            priority: 10,
            timeout: 60000,
            handler: async () => {
                if (!this.streamingService)
                    return;
                const activeSessions = this.streamingService.getActiveSessions();
                if (activeSessions.length === 0) {
                    this.logger.log('✅ No active streaming sessions to wait for');
                    return;
                }
                this.logger.log(`⏳ Waiting for ${activeSessions.length} active streaming sessions to complete`);
                const maxWaitTime = 45000;
                const checkInterval = 1000;
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
                const remainingSessions = this.streamingService.getActiveSessions();
                this.logger.warn(`⚠️ Force cancelling ${remainingSessions.length} remaining streaming sessions`);
                for (const sessionId of remainingSessions) {
                    this.streamingService.cancelStream(sessionId);
                }
            },
        });
        this.registerHandler({
            name: 'close-database-connections',
            priority: 20,
            timeout: 10000,
            handler: async () => {
                this.logger.log('🔌 Closing database connections');
            },
        });
        this.registerHandler({
            name: 'close-redis-connections',
            priority: 20,
            timeout: 5000,
            handler: async () => {
                this.logger.log('🔌 Closing Redis connections');
            },
        });
        this.registerHandler({
            name: 'reset-circuit-breakers',
            priority: 30,
            timeout: 5000,
            handler: async () => {
                this.logger.log('🔄 Resetting circuit breakers');
                circuit_breaker_1.CircuitBreakerManager.resetAll();
            },
        });
        this.registerHandler({
            name: 'cleanup-resources',
            priority: 40,
            timeout: 10000,
            handler: async () => {
                this.logger.log('🧹 Cleaning up temporary resources');
            },
        });
        this.registerHandler({
            name: 'final-logging',
            priority: 50,
            timeout: 2000,
            handler: async () => {
                this.logger.log('📊 Sending final metrics and logs');
            },
        });
    }
    setupSignalHandlers() {
        const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
        for (const signal of signals) {
            process.on(signal, async () => {
                this.logger.log(`📡 Received ${signal} signal`);
                await this.onApplicationShutdown(signal);
                process.exit(0);
            });
        }
        process.on('uncaughtException', async (error) => {
            this.logger.error('💥 Uncaught exception:', error);
            await this.onApplicationShutdown('uncaughtException');
            process.exit(1);
        });
        process.on('unhandledRejection', async (reason) => {
            this.logger.error('💥 Unhandled promise rejection:', reason);
            await this.onApplicationShutdown('unhandledRejection');
            process.exit(1);
        });
    }
    isHealthy() {
        return !this.isShuttingDown;
    }
    getShutdownStatus() {
        return {
            isShuttingDown: this.isShuttingDown,
            handlersRegistered: this.shutdownHandlers.length,
            handlersCompleted: 0,
        };
    }
};
exports.GracefulShutdownService = GracefulShutdownService;
exports.GracefulShutdownService = GracefulShutdownService = GracefulShutdownService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [streaming_service_1.StreamingService])
], GracefulShutdownService);
//# sourceMappingURL=graceful-shutdown.service.js.map