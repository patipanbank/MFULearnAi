"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.asyncHandler = exports.errorHandler = void 0;
const AppError_1 = require("../errors/AppError");
/**
 * Global error handler middleware
 * Should be registered last in the middleware chain
 */
const errorHandler = (err, req, res, _next) => {
    // Log the error for debugging
    console.error('Error:', {
        name: err.name,
        message: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
        path: req.path,
        method: req.method,
    });
    // Handle AppError instances
    if (err instanceof AppError_1.AppError) {
        const response = {
            success: false,
            error: err.message,
        };
        if (err.details) {
            response.details = err.details;
        }
        if (process.env.NODE_ENV !== 'production') {
            response.stack = err.stack;
        }
        res.status(err.statusCode).json(response);
        return;
    }
    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        res.status(401).json({
            success: false,
            error: 'Invalid token',
        });
        return;
    }
    if (err.name === 'TokenExpiredError') {
        res.status(401).json({
            success: false,
            error: 'Token expired',
        });
        return;
    }
    // Handle MongoDB errors
    if (err.name === 'CastError') {
        res.status(400).json({
            success: false,
            error: 'Invalid ID format',
        });
        return;
    }
    if (err.name === 'ValidationError') {
        res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: err.message,
        });
        return;
    }
    // Handle Multer errors
    if (err.name === 'MulterError') {
        let message = 'File upload error';
        if (err.code === 'LIMIT_FILE_SIZE') {
            message = 'File too large';
        }
        res.status(400).json({
            success: false,
            error: message,
        });
        return;
    }
    // Default to 500 Internal Server Error
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
};
exports.errorHandler = errorHandler;
/**
 * Async handler wrapper to catch errors in async route handlers
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
/**
 * Not found handler - catches 404 errors
 * Should be registered after all routes
 */
const notFoundHandler = (req, res, _next) => {
    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.path} not found`,
    });
};
exports.notFoundHandler = notFoundHandler;
