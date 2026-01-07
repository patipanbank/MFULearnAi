import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

/**
 * Input validation middleware
 */

export const validateCollectionName = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Collection name must be between 3 and 100 characters')
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Collection name can only contain letters, numbers, hyphens, and underscores')
    .custom((value) => {
      // Prevent reserved names
      const reserved = ['default', 'admin', 'system', 'root', 'null', 'undefined'];
      if (reserved.includes(value.toLowerCase())) {
        throw new Error('Collection name is reserved');
      }
      return true;
    })
];

export const validateModelId = [
  body('modelId')
    .trim()
    .notEmpty()
    .withMessage('Model ID is required')
    .isLength({ max: 100 })
    .withMessage('Model ID must not exceed 100 characters')
];

export const validateCollectionId = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('Collection ID is required')
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Invalid collection ID format')
];

export const validateCollectionNameQuery = [
  query('collectionName')
    .trim()
    .notEmpty()
    .withMessage('Collection name is required')
    .isLength({ max: 100 })
    .withMessage('Collection name must not exceed 100 characters')
];

export const validatePermission = [
  body('permission')
    .optional()
    .isIn(['PUBLIC', 'PRIVATE'])
    .withMessage('Permission must be either PUBLIC or PRIVATE')
];

/**
 * Sanitize string inputs to prevent injection attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .slice(0, 10000); // Limit length
}

/**
 * Validate and sanitize request body
 */
export function sanitizeRequestBody(req: Request, res: Response, next: NextFunction) {
  if (req.body) {
    // Sanitize string fields
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    });
  }
  next();
}

/**
 * Check validation results
 */
export function checkValidation(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
}
