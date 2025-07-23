"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQuery = exports.validateBody = exports.validate = void 0;
const zod_1 = require("zod");
const validate = (schema) => {
    return async (req, res, next) => {
        try {
            const validatedData = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            req.body = validatedData.body;
            req.query = validatedData.query;
            req.params = validatedData.params;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: error.errors.map((err) => ({
                        field: err.path.join('.'),
                        message: err.message
                    }))
                });
                return;
            }
            res.status(500).json({
                success: false,
                error: 'Internal validation error'
            });
        }
    };
};
exports.validate = validate;
const validateBody = (schema) => {
    return async (req, res, next) => {
        try {
            const validatedBody = await schema.parseAsync(req.body);
            req.body = validatedBody;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid request body',
                    details: error.errors.map((err) => ({
                        field: err.path.join('.'),
                        message: err.message
                    }))
                });
                return;
            }
            res.status(500).json({
                success: false,
                error: 'Internal validation error'
            });
        }
    };
};
exports.validateBody = validateBody;
const validateQuery = (schema) => {
    return async (req, res, next) => {
        try {
            const validatedQuery = await schema.parseAsync(req.query);
            req.query = validatedQuery;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid query parameters',
                    details: error.errors.map((err) => ({
                        field: err.path.join('.'),
                        message: err.message
                    }))
                });
                return;
            }
            res.status(500).json({
                success: false,
                error: 'Internal validation error'
            });
        }
    };
};
exports.validateQuery = validateQuery;
//# sourceMappingURL=validation.js.map