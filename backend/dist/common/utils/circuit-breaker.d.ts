export declare enum CircuitBreakerState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
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
export declare class CircuitBreaker {
    private readonly name;
    private readonly logger;
    private state;
    private stats;
    private nextAttempt;
    private readonly options;
    constructor(name: string, options?: CircuitBreakerOptions);
    execute<T>(operation: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onError;
    private isExpectedError;
    private shouldAttemptReset;
    private scheduleNextAttempt;
    private setState;
    getState(): CircuitBreakerState;
    getStats(): CircuitBreakerStats & {
        failureRate: number;
        uptime: number;
        isHealthy: boolean;
    };
    reset(): void;
    forceOpen(): void;
    forceClose(): void;
}
export declare function CircuitBreak(options: CircuitBreakerOptions & {
    name: string;
}): (target: any, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export declare class CircuitBreakerManager {
    private static breakers;
    private static readonly logger;
    static register(name: string, breaker: CircuitBreaker): void;
    static unregister(name: string): void;
    static get(name: string): CircuitBreaker | undefined;
    static getAll(): Map<string, CircuitBreaker>;
    static getHealthStatus(): Record<string, any>;
    static resetAll(): void;
}
export {};
