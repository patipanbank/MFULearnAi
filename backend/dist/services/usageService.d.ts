interface UsageStats {
    userId: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    chatCount: number;
    lastUsed: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare class UsageService {
    constructor();
    updateUsage(userId: string, inputTokens: number, outputTokens: number): Promise<void>;
    getUserUsage(userId: string): Promise<UsageStats | null>;
    getTotalUsage(): Promise<{
        totalInputTokens: number;
        totalOutputTokens: number;
        totalTokens: number;
        totalChats: number;
        activeUsers: number;
    }>;
    resetUserUsage(userId: string): Promise<void>;
}
export declare const usageService: UsageService;
export {};
//# sourceMappingURL=usageService.d.ts.map