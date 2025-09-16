import { Request, Response, NextFunction } from 'express';
interface RequestWithMetrics extends Request {
    startTime?: number;
    requestId?: string;
}
export declare const metricsMiddleware: (req: RequestWithMetrics, res: Response, next: NextFunction) => void;
export declare const databaseMetricsWrapper: <T>(operation: () => Promise<T>) => Promise<T>;
export declare const cacheMetricsWrapper: {
    hit: () => void;
    miss: () => void;
};
export declare const websocketMetrics: {
    onConnection: () => void;
    onDisconnection: (connectionStartTime: number) => void;
};
export declare const metricsEndpoint: (req: Request, res: Response) => void;
export declare const healthEndpoint: (req: Request, res: Response) => void;
export declare const performanceTimer: (operationName: string) => {
    end: () => number;
};
declare const _default: {
    metricsMiddleware: (req: RequestWithMetrics, res: Response, next: NextFunction) => void;
    databaseMetricsWrapper: <T>(operation: () => Promise<T>) => Promise<T>;
    cacheMetricsWrapper: {
        hit: () => void;
        miss: () => void;
    };
    websocketMetrics: {
        onConnection: () => void;
        onDisconnection: (connectionStartTime: number) => void;
    };
    metricsEndpoint: (req: Request, res: Response) => void;
    healthEndpoint: (req: Request, res: Response) => void;
    performanceTimer: (operationName: string) => {
        end: () => number;
    };
};
export default _default;
//# sourceMappingURL=metricsMiddleware.d.ts.map