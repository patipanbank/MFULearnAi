export interface AppConfig {
    environment: 'development' | 'production' | 'test';
    port: number;
    apiPrefix: string;
    cors: {
        origin: string | string[];
        credentials: boolean;
        methods: string[];
        allowedHeaders: string[];
        exposedHeaders: string[];
        maxAge: number;
    };
    swagger: {
        enabled: boolean;
        title: string;
        description: string;
        version: string;
        path: string;
    };
    logging: {
        level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
        format: 'json' | 'simple';
        filename?: string;
        maxSize: string;
        maxFiles: number;
        datePattern: string;
    };
    health: {
        enabled: boolean;
        path: string;
        timeout: number;
    };
    monitoring: {
        enabled: boolean;
        metricsPath: string;
        interval: number;
    };
    gracefulShutdown: {
        timeout: number;
        signals: string[];
    };
}
export declare const appConfig: () => AppConfig;
