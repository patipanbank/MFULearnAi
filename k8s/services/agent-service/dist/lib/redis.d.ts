/**
 * Redis stub - LangGraph now handles persistence with MemorySaver
 */
export declare const redis: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any, ...args: any[]) => Promise<void>;
    del: (key: string) => Promise<void>;
};
//# sourceMappingURL=redis.d.ts.map