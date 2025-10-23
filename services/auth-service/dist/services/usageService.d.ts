interface UsageStats {
    userId: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    chatCount: number;
    dailyUsage: {
        date: string;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
    lastUsed: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare class UsageService {
    constructor();
    checkQuotaAndUsage(userId: string, inputTokens: number, outputTokens: number): Promise<{
        canUse: boolean;
        reason?: string;
        usage?: UsageStats;
    }>;
    updateUsage(userId: string, inputTokens: number, outputTokens: number): Promise<{
        success: boolean;
        reason?: string;
    }>;
    getUserUsage(userId: string): Promise<UsageStats | null>;
    getTotalUsage(): Promise<{
        totalInputTokens: number;
        totalOutputTokens: number;
        totalTokens: number;
        totalChats: number;
        activeUsers: number;
    }>;
    resetUserUsage(userId: string): Promise<void>;
    getUserQuotaInfo(userId: string): Promise<{
        user: {
            tokenQuota?: number;
            dailyTokenLimit?: number;
        } | null;
        usage: UsageStats | null;
        remainingQuota?: number;
        remainingDaily?: number;
    }>;
    updateUserQuota(userId: string, tokenQuota?: number, dailyTokenLimit?: number): Promise<void>;
}
export declare const usageService: UsageService;
export {};
//# sourceMappingURL=usageService.d.ts.map