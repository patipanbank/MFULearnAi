export declare const createRateLimiters: () => {
    general: import("express-rate-limit").RateLimitRequestHandler;
    auth: import("express-rate-limit").RateLimitRequestHandler;
    chat: import("express-rate-limit").RateLimitRequestHandler;
    agent: import("express-rate-limit").RateLimitRequestHandler;
    upload: import("express-rate-limit").RateLimitRequestHandler;
    websocket: import("express-rate-limit").RateLimitRequestHandler;
};
export declare const createUserRateLimiter: (windowMs: number, max: number) => import("express-rate-limit").RateLimitRequestHandler;
export declare const adminBypass: (req: any, res: any, next: any) => any;
//# sourceMappingURL=rateLimit.d.ts.map