import { Redis } from 'ioredis';
interface CacheStats {
    totalEntries: number;
    hitRate: number;
    missRate: number;
}
export declare class CacheService {
    private readonly redis;
    private readonly logger;
    private readonly stats;
    constructor(redis: Redis);
    set(key: string, value: any, ttl?: number): Promise<void>;
    get(key: string): Promise<any>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    getStats(): CacheStats;
    optimizeCache(): Promise<void>;
    warmupCache(dataItems: Array<{
        key: string;
        value: any;
        ttl?: number;
    }>): Promise<void>;
    exportCache(): Promise<{
        entries: any[];
        stats: CacheStats;
    }>;
    importCache(data: {
        entries: any[];
        stats?: CacheStats;
    }): Promise<void>;
    findSimilarEntries(query: string, topK?: number, minSimilarity?: number): Promise<Array<{
        key: string;
        similarity: number;
        value: any;
    }>>;
}
export {};
