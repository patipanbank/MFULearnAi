import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (req: Request) => string;
    skipIf?: (req: Request) => boolean;
    message?: string;
    statusCode?: number;
}
export declare class RateLimitMiddleware implements NestMiddleware {
    private readonly logger;
    private readonly redis;
    private readonly defaultConfig;
    constructor();
    use(req: Request, res: Response, next: NextFunction): void;
    static create(config: Partial<RateLimitConfig>): (req: Request, res: Response, next: NextFunction) => void;
    private applyRateLimit;
    private generateKey;
    private getClientIp;
}
export declare class RateLimitPresets {
    static auth(): (req: Request, res: Response, next: NextFunction) => void;
    static api(): (req: Request, res: Response, next: NextFunction) => void;
    static upload(): (req: Request, res: Response, next: NextFunction) => void;
    static chat(): (req: Request, res: Response, next: NextFunction) => void;
    static admin(): (req: Request, res: Response, next: NextFunction) => void;
    static health(): (req: Request, res: Response, next: NextFunction) => void;
}
