"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePermission = exports.validateCollectionNameQuery = exports.validateCollectionId = exports.validateModelId = exports.validateCollectionName = void 0;
exports.sanitizeString = sanitizeString;
exports.sanitizeRequestBody = sanitizeRequestBody;
exports.checkValidation = checkValidation;
const express_validator_1 = require("express-validator");
/**
 * Input validation middleware
 */
exports.validateCollectionName = [
    (0, express_validator_1.body)('name')
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
exports.validateModelId = [
    (0, express_validator_1.body)('modelId')
        .trim()
        .notEmpty()
        .withMessage('Model ID is required')
        .isLength({ max: 100 })
        .withMessage('Model ID must not exceed 100 characters')
];
exports.validateCollectionId = [
    (0, express_validator_1.param)('id')
        .trim()
        .notEmpty()
        .withMessage('Collection ID is required')
        .matches(/^[0-9a-fA-F]{24}$/)
        .withMessage('Invalid collection ID format')
];
exports.validateCollectionNameQuery = [
    (0, express_validator_1.query)('collectionName')
        .trim()
        .notEmpty()
        .withMessage('Collection name is required')
        .isLength({ max: 100 })
        .withMessage('Collection name must not exceed 100 characters')
];
exports.validatePermission = [
    (0, express_validator_1.body)('permission')
        .optional()
        .isIn(['PUBLIC', 'PRIVATE'])
        .withMessage('Permission must be either PUBLIC or PRIVATE')
];
/**
 * Sanitize string inputs to prevent injection attacks
 */
function sanitizeString(input) {
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
function sanitizeRequestBody(req, res, next) {
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
function checkValidation(req, res, next) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({
            error: 'Validation failed',
            errors: errors.array()
        });
        return;
    }
    next();
}
