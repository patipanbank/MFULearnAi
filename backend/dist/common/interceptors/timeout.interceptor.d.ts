import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
export interface TimeoutOptions {
    timeout?: number;
    message?: string;
    excludePaths?: string[];
    dynamicTimeout?: (context: ExecutionContext) => number;
}
export declare class TimeoutInterceptor implements NestInterceptor {
    private readonly options;
    private readonly logger;
    private readonly defaultTimeout;
    constructor(options?: TimeoutOptions);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
    private getTimeoutValue;
}
export declare const ShortTimeout: () => TimeoutInterceptor;
export declare const MediumTimeout: () => TimeoutInterceptor;
export declare const LongTimeout: () => TimeoutInterceptor;
export declare const StreamingTimeout: () => TimeoutInterceptor;
export declare const DynamicTimeout: () => TimeoutInterceptor;
export declare function Timeout(timeoutMs: number, message?: string): (target: any, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
