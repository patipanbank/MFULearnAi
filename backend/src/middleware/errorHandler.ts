/**
 * Express Async Error Handler
 *
 * Wraps async route handlers to automatically catch errors
 * and forward them to Express error middleware.
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 */

import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/LoggerService';

/**
 * Wraps an async Express handler, catching rejected promises
 * and forwarding them to the Express error handler.
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Global Express error handler (must be registered last).
 * Catches unhandled errors from route handlers.
 */
export const globalErrorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
    const statusCode = err.statusCode || 500;
    const isProduction = process.env.ENV_TYPE === 'PROD';

    LoggerService.error('unhandled_route_error', {
        method: req.method,
        url: req.originalUrl,
        statusCode,
        message: err.message,
        stack: isProduction ? undefined : err.stack,
    });

    res.status(statusCode).json({
        error: isProduction ? 'Internal Server Error' : err.message,
        ...(isProduction ? {} : { stack: err.stack }),
    });
};

/**
 * 404 handler for unmatched routes.
 */
export const notFoundHandler = (req: Request, res: Response) => {
    res.status(404).json({
        error: 'Not Found',
        path: req.originalUrl,
    });
};
