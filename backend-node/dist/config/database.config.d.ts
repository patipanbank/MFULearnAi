export interface DatabaseConfig {
    mongodb: {
        uri: string;
        options: {
            retryWrites: boolean;
            w: string;
            maxPoolSize: number;
            minPoolSize: number;
            serverSelectionTimeoutMS: number;
            socketTimeoutMS: number;
            bufferMaxEntries: number;
            bufferCommands: boolean;
        };
    };
    redis: {
        host: string;
        port: number;
        password?: string;
        db: number;
        retryDelayOnFailover: number;
        maxRetriesPerRequest: number;
        keyPrefix: string;
        lazyConnect: boolean;
    };
    chroma: {
        url: string;
        timeout: number;
        retries: number;
    };
}
export declare const databaseConfig: () => DatabaseConfig;
