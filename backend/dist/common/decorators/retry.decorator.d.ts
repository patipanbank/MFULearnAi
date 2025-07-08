export interface RetryOptions {
    maxAttempts?: number;
    delay?: number;
    backoffMultiplier?: number;
    maxDelay?: number;
    retryOn?: (error: any) => boolean;
    onRetry?: (error: any, attempt: number) => void;
}
export declare function Retry(options?: RetryOptions): (target: any, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export declare const NetworkRetry: () => (target: any, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export declare const DatabaseRetry: () => (target: any, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export declare const ExternalServiceRetry: () => (target: any, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
