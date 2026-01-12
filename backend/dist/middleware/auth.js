"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.verifyWSToken = exports.requireAuth = exports.authorize = exports.optionalAuth = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errors_1 = require("../errors");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
/**
 * Extract token from Authorization header
 */
const extractToken = (authHeader) => {
    if (!authHeader)
        return null;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer')
        return null;
    return parts[1];
};
/**
 * Verify and decode JWT token
 */
const verifyToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch (error) {
        throw new errors_1.UnauthorizedError('Invalid or expired token');
    }
};
/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
const authenticate = (req, res, next) => {
    try {
        const token = extractToken(req.headers.authorization);
        if (!token) {
            throw new errors_1.UnauthorizedError('No token provided');
        }
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.authenticate = authenticate;
/**
 * Optional authentication middleware
 * Attaches user if token exists, continues regardless
 */
const optionalAuth = (req, res, next) => {
    try {
        const token = extractToken(req.headers.authorization);
        if (token) {
            const decoded = verifyToken(token);
            req.user = decoded;
        }
        next();
    }
    catch {
        // Continue without user if token is invalid
        next();
    }
};
exports.optionalAuth = optionalAuth;
/**
 * Role-based authorization middleware
 * Must be used after authenticate middleware
 *
 * @param allowedRoles - Array of roles that can access the route
 */
const authorize = (allowedRoles) => {
    return (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                throw new errors_1.UnauthorizedError('Not authenticated');
            }
            const userGroups = user.groups || [];
            const hasAllowedRole = allowedRoles.some(role => userGroups.includes(role));
            // SuperAdmin and Admin have access to everything
            const isAdmin = userGroups.includes('Admin');
            const isSuperAdmin = userGroups.includes('SuperAdmin');
            if (!hasAllowedRole && !isAdmin && !isSuperAdmin) {
                throw new errors_1.ForbiddenError('Insufficient permissions');
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.authorize = authorize;
/**
 * Combined authentication and authorization middleware
 * Convenience function that combines authenticate and authorize
 *
 * @param allowedRoles - Array of roles that can access the route
 */
const requireAuth = (allowedRoles) => {
    const middlewares = [exports.authenticate];
    if (allowedRoles && allowedRoles.length > 0) {
        middlewares.push((0, exports.authorize)(allowedRoles));
    }
    return middlewares;
};
exports.requireAuth = requireAuth;
/**
 * Verify WebSocket token
 * Returns decoded user or throws error
 */
const verifyWSToken = (token) => {
    return verifyToken(token);
};
exports.verifyWSToken = verifyWSToken;
/**
 * Generate JWT token for user
 */
const generateToken = (payload, expiresIn = '24h') => {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn });
};
exports.generateToken = generateToken;
