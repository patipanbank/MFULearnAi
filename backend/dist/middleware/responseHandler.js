"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityHeaders = exports.corsHandler = exports.responseTime = exports.responseHandler = void 0;
const responseHandler = (req, res, next) => {
    const requestId = req.headers['x-request-id'] ||
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader('X-Request-ID', requestId);
    res.success = function (data, message, meta) {
        const response = {
            success: true,
            data,
            message,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: requestId,
                version: '1.0',
                ...meta
            }
        };
        this.json(response);
    };
    res.successList = function (data, meta) {
        const response = {
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
                requestId: requestId,
                version: '1.0',
                ...meta
            }
        };
        this.json(response);
    };
    res.paginate = function (data, total, limit, offset) {
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
    res.error = function (error, code, statusCode = 500, details) {
        const response = {
            success: false,
            error,
            code,
            details,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: requestId,
                version: '1.0'
            }
        };
        this.status(statusCode).json(response);
    };
    next();
};
exports.responseHandler = responseHandler;
const responseTime = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        res.setHeader('X-Response-Time', `${duration}ms`);
        if (duration > 1000) {
            console.warn(`Slow request detected: ${req.method} ${req.originalUrl} - ${duration}ms`);
        }
    });
    next();
};
exports.responseTime = responseTime;
const corsHandler = (req, res, next) => {
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
exports.corsHandler = corsHandler;
const securityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    next();
};
exports.securityHeaders = securityHeaders;
//# sourceMappingURL=responseHandler.js.map