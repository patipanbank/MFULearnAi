import { AppService } from './app.service';
import { RedisService } from './redis/redis.service';
export declare class AppController {
    private readonly appService;
    private readonly redisService;
    constructor(appService: AppService, redisService: RedisService);
    getHello(): string;
    health(): {
        status: string;
    };
    testRedis(): Promise<{
        success: boolean;
        message: string;
        testValue: string | null;
        error?: undefined;
    } | {
        success: boolean;
        message: string;
        error: any;
        testValue?: undefined;
    }>;
}
