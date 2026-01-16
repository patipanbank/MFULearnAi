"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkValidation = exports.sanitizeRequestBody = exports.validatePermission = exports.validateCollectionId = exports.validateModelId = exports.validateCollectionName = exports.uploadRateLimiter = exports.createRateLimitMiddleware = exports.roleGuard = exports.notFoundHandler = exports.asyncHandler = exports.errorHandler = exports.generateToken = exports.verifyWSToken = exports.requireAuth = exports.authorize = exports.optionalAuth = exports.authenticate = void 0;
// Authentication middleware
var auth_1 = require("./auth");
Object.defineProperty(exports, "authenticate", { enumerable: true, get: function () { return auth_1.authenticate; } });
Object.defineProperty(exports, "optionalAuth", { enumerable: true, get: function () { return auth_1.optionalAuth; } });
Object.defineProperty(exports, "authorize", { enumerable: true, get: function () { return auth_1.authorize; } });
Object.defineProperty(exports, "requireAuth", { enumerable: true, get: function () { return auth_1.requireAuth; } });
Object.defineProperty(exports, "verifyWSToken", { enumerable: true, get: function () { return auth_1.verifyWSToken; } });
Object.defineProperty(exports, "generateToken", { enumerable: true, get: function () { return auth_1.generateToken; } });
// Error handling middleware
var errorHandler_1 = require("./errorHandler");
Object.defineProperty(exports, "errorHandler", { enumerable: true, get: function () { return errorHandler_1.errorHandler; } });
Object.defineProperty(exports, "asyncHandler", { enumerable: true, get: function () { return errorHandler_1.asyncHandler; } });
Object.defineProperty(exports, "notFoundHandler", { enumerable: true, get: function () { return errorHandler_1.notFoundHandler; } });
// Role guard (legacy - use authorize instead)
var roleGuard_1 = require("./roleGuard");
Object.defineProperty(exports, "roleGuard", { enumerable: true, get: function () { return roleGuard_1.roleGuard; } });
// Rate limiting
var rateLimiter_1 = require("./rateLimiter");
Object.defineProperty(exports, "createRateLimitMiddleware", { enumerable: true, get: function () { return rateLimiter_1.createRateLimitMiddleware; } });
Object.defineProperty(exports, "uploadRateLimiter", { enumerable: true, get: function () { return rateLimiter_1.uploadRateLimiter; } });
// Input validation
var inputValidation_1 = require("./inputValidation");
Object.defineProperty(exports, "validateCollectionName", { enumerable: true, get: function () { return inputValidation_1.validateCollectionName; } });
Object.defineProperty(exports, "validateModelId", { enumerable: true, get: function () { return inputValidation_1.validateModelId; } });
Object.defineProperty(exports, "validateCollectionId", { enumerable: true, get: function () { return inputValidation_1.validateCollectionId; } });
Object.defineProperty(exports, "validatePermission", { enumerable: true, get: function () { return inputValidation_1.validatePermission; } });
Object.defineProperty(exports, "sanitizeRequestBody", { enumerable: true, get: function () { return inputValidation_1.sanitizeRequestBody; } });
Object.defineProperty(exports, "checkValidation", { enumerable: true, get: function () { return inputValidation_1.checkValidation; } });
