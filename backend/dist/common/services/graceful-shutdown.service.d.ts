import { OnApplicationShutdown } from '@nestjs/common';
import { StreamingService } from '../../services/streaming.service';
export interface ShutdownHandler {
    name: string;
    handler: () => Promise<void>;
    timeout?: number;
    priority?: number;
}
export declare class GracefulShutdownService implements OnApplicationShutdown {
    private readonly streamingService?;
    private readonly logger;
    private readonly shutdownHandlers;
    private isShuttingDown;
    private readonly defaultTimeout;
    constructor(streamingService?: StreamingService | undefined);
    onApplicationShutdown(signal?: string): Promise<void>;
    registerHandler(handler: ShutdownHandler): void;
    private executeShutdownSequence;
    private createTimeoutPromise;
    private registerDefaultHandlers;
    private setupSignalHandlers;
    isHealthy(): boolean;
    getShutdownStatus(): {
        isShuttingDown: boolean;
        handlersRegistered: number;
        handlersCompleted: number;
    };
}
