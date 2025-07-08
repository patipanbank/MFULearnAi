import { StatsService } from './stats.service';
export declare class StatsController {
    private readonly statsService;
    constructor(statsService: StatsService);
    getDailyStats(start?: string, end?: string): Promise<{
        date: Date;
        uniqueUsers: number;
        totalChats: number;
        totalTokens: number;
    }[]>;
    total(): Promise<{
        totalUsers: number;
        totalChats: number;
        totalTokens: any;
    }>;
    dailyChats(): Promise<{
        date: string;
        totalChatsToday: number;
    }>;
}
