// Authentication middleware
export { 
  authenticate, 
  optionalAuth, 
  authorize, 
  requireAuth,
  verifyWSToken,
  generateToken,
} from './auth';

// Error handling middleware
export { 
  errorHandler, 
  asyncHandler, 
  notFoundHandler 
} from './errorHandler';

// Role guard (legacy - use authorize instead)
export { roleGuard } from './roleGuard';

// Rate limiting
export { 
  createRateLimitMiddleware, 
  uploadRateLimiter 
} from './rateLimiter';

// Input validation
export { 
  validateCollectionName, 
  validateModelId, 
  validateCollectionId,
  validatePermission,
  sanitizeRequestBody,
  checkValidation,
} from './inputValidation';
