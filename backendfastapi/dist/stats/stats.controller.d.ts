import { StatsService, DailyStat, TotalStats, DailyChatStats } from './stats.service';
declare class GetStatsQueryDto {
    start_date?: string;
    end_date?: string;
}
export declare class StatsController {
    private readonly statsService;
    constructor(statsService: StatsService);
    getDailyStats(req: any, query: GetStatsQueryDto): Promise<DailyStat[]>;
    getTotalStats(req: any): Promise<TotalStats>;
    getDailyChatStats(req: any): Promise<DailyChatStats>;
    getUserStats(req: any): Promise<any>;
    getSystemHealth(req: any): Promise<any>;
}
export {};
