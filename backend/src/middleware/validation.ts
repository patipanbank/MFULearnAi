import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Validation Middleware - ตรวจสอบ request ด้วย Zod schemas
 */

export interface ValidationSchema {
  params?: z.ZodSchema;
  query?: z.ZodSchema;  
  body?: z.ZodSchema;
  headers?: z.ZodSchema;
}

export const validateRequest = (schema: z.ZodSchema | ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Handle single schema (backward compatibility)
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

      // Handle multi-part validation
      const validationSchema = schema as ValidationSchema;
      const errors: any[] = [];

      // Validate params
      if (validationSchema.params) {
        const result = validationSchema.params.safeParse(req.params);
        if (!result.success) {
          errors.push(...result.error.errors.map(err => ({
            ...err,
            location: 'params'
          })));
        } else {
          req.params = result.data;
        }
      }

      // Validate query
      if (validationSchema.query) {
        const result = validationSchema.query.safeParse(req.query);
        if (!result.success) {
          errors.push(...result.error.errors.map(err => ({
            ...err,
            location: 'query'
          })));
        } else {
          req.query = result.data;
        }
      }

      // Validate body
      if (validationSchema.body) {
        const result = validationSchema.body.safeParse(req.body);
        if (!result.success) {
          errors.push(...result.error.errors.map(err => ({
            ...err,
            location: 'body'
          })));
        } else {
          req.body = result.data;
        }
      }

      // Validate headers
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
    } catch (error) {
      console.error('Validation middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
};

// Common validation schemas
export const commonSchemas = {
  pagination: z.object({
    limit: z.string().transform(val => parseInt(val)).refine(val => val > 0 && val <= 100, {
      message: 'Limit must be between 1 and 100'
    }).optional(),
    offset: z.string().transform(val => parseInt(val)).refine(val => val >= 0, {
      message: 'Offset must be non-negative'
    }).optional()
  }),
  
  mongoId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId'),
  
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional()
  }).refine(data => {
    if (data.from && data.to) {
      return new Date(data.from) <= new Date(data.to);
    }
    return true;
  }, {
    message: 'From date must be before or equal to To date'
  }),

  search: z.object({
    query: z.string().min(1).max(500).optional(),
    fields: z.array(z.string()).optional(),
    caseSensitive: z.boolean().optional()
  })
};

// Validation error handler
export const handleValidationError = (error: z.ZodError) => {
  return {
    success: false,
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
      value: err.input
    }))
  };
};