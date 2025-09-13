"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleValidationError = exports.commonSchemas = exports.validateRequest = void 0;
const zod_1 = require("zod");
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            if ('_def' in schema) {
                const result = schema.safeParse(req.body);
                if (!result.success) {
                    return res.status(400).json({
                        success: false,
                        error: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: result.error.errors
                    });
                }
                req.body = result.data;
                return next();
            }
            const validationSchema = schema;
            const errors = [];
            if (validationSchema.params) {
                const result = validationSchema.params.safeParse(req.params);
                if (!result.success) {
                    errors.push(...result.error.errors.map(err => ({
                        ...err,
                        location: 'params'
                    })));
                }
                else {
                    req.params = result.data;
                }
            }
            if (validationSchema.query) {
                const result = validationSchema.query.safeParse(req.query);
                if (!result.success) {
                    errors.push(...result.error.errors.map(err => ({
                        ...err,
                        location: 'query'
                    })));
                }
                else {
                    req.query = result.data;
                }
            }
            if (validationSchema.body) {
                const result = validationSchema.body.safeParse(req.body);
                if (!result.success) {
                    errors.push(...result.error.errors.map(err => ({
                        ...err,
                        location: 'body'
                    })));
                }
                else {
                    req.body = result.data;
                }
            }
            if (validationSchema.headers) {
                const result = validationSchema.headers.safeParse(req.headers);
                if (!result.success) {
                    errors.push(...result.error.errors.map(err => ({
                        ...err,
                        location: 'headers'
                    })));
                }
            }
            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: errors
                });
            }
            next();
        }
        catch (error) {
            console.error('Validation middleware error:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal validation error',
                code: 'VALIDATION_INTERNAL_ERROR'
            });
        }
    };
};
exports.validateRequest = validateRequest;
exports.commonSchemas = {
    pagination: zod_1.z.object({
        limit: zod_1.z.string().transform(val => parseInt(val)).refine(val => val > 0 && val <= 100, {
            message: 'Limit must be between 1 and 100'
        }).optional(),
        offset: zod_1.z.string().transform(val => parseInt(val)).refine(val => val >= 0, {
            message: 'Offset must be non-negative'
        }).optional()
    }),
    mongoId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId'),
    dateRange: zod_1.z.object({
        from: zod_1.z.string().datetime().optional(),
        to: zod_1.z.string().datetime().optional()
    }).refine(data => {
        if (data.from && data.to) {
            return new Date(data.from) <= new Date(data.to);
        }
        return true;
    }, {
        message: 'From date must be before or equal to To date'
    }),
    search: zod_1.z.object({
        query: zod_1.z.string().min(1).max(500).optional(),
        fields: zod_1.z.array(zod_1.z.string()).optional(),
        caseSensitive: zod_1.z.boolean().optional()
    })
};
const handleValidationError = (error) => {
    return {
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            value: err.input || 'N/A'
        }))
    };
};
exports.handleValidationError = handleValidationError;
//# sourceMappingURL=validation.js.map