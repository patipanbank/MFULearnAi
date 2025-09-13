import { Request, Response, NextFunction } from 'express';
import { ApiResponse, ApiListResponse } from '../types/api.types';

/**
 * Response Handler Middleware - จัดรูปแบบ response ให้เป็นมาตรฐาน
 */

declare global {
  namespace Express {
    interface Response {
      success<T>(data?: T, message?: string, meta?: any): void;
      successList<T>(data: T[], meta: any): void;
      error(error: string, code: string, statusCode?: number, details?: any): void;
      paginate<T>(data: T[], total: number, limit?: number, offset?: number): void;
    }
  }
}

export const responseHandler = (req: Request, res: Response, next: NextFunction): void => {
  // Generate request ID if not exists
  const requestId = req.headers['x-request-id'] || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Set request ID in response headers
  res.setHeader('X-Request-ID', requestId);

  /**
   * Success response
   */
  res.success = function<T>(data?: T, message?: string, meta?: any): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: requestId as string,
        version: '1.0',
        ...meta
      }
    };

    this.json(response);
  };

  /**
   * Success list response with metadata
   */
  res.successList = function<T>(data: T[], meta: any): void {
    const response: ApiListResponse<T> = {
      success: true,
      data,
      meta: {
        total: meta.total || data.length,
        limit: meta.limit || null,
        offset: meta.offset || 0,
        page: meta.page || (meta.offset && meta.limit ? Math.floor(meta.offset / meta.limit) + 1 : undefined),
        hasNext: meta.limit ? (meta.offset + meta.limit) < meta.total : false,
        hasPrev: meta.offset ? meta.offset > 0 : false,
        timestamp: new Date().toISOString(),
        requestId: requestId as string,
        version: '1.0',
        ...meta
      }
    };

    this.json(response);
  };

  /**
   * Paginated response
   */
  res.paginate = function<T>(data: T[], total: number, limit?: number, offset?: number): void {
    const actualLimit = limit || data.length;
    const actualOffset = offset || 0;
    const currentPage = Math.floor(actualOffset / actualLimit) + 1;
    
    this.successList(data, {
      total,
      limit: actualLimit,
      offset: actualOffset,
      page: currentPage,
      hasNext: (actualOffset + actualLimit) < total,
      hasPrev: actualOffset > 0
    });
  };

  /**
   * Error response
   */
  res.error = function(error: string, code: string, statusCode = 500, details?: any): void {
    const response: ApiResponse = {
      success: false,
      error,
      code,
      details,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: requestId as string,
        version: '1.0'
      }
    };

    this.status(statusCode).json(response);
  };

  next();
};

// Response time middleware
export const responseTime = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    // Log slow requests
    if (duration > 1000) {
      console.warn(`Slow request detected: ${req.method} ${req.originalUrl} - ${duration}ms`);
    }
  });

  next();
};

// CORS headers
export const corsHandler = (req: Request, res: Response, next: NextFunction): void => {
  const origin = req.headers.origin;
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

  if (allowedOrigins.includes(origin || '')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
};

// Security headers
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
};