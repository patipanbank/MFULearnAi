"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminRole = exports.requireAnyRole = exports.requireRoles = exports.authenticateJWT = exports.UserRole = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config/config"));
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "Admin";
    UserRole["STAFFS"] = "Staffs";
    UserRole["STUDENTS"] = "Students";
    UserRole["SUPER_ADMIN"] = "SuperAdmin";
})(UserRole || (exports.UserRole = UserRole = {}));
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ detail: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.default.JWT_SECRET);
        req.user = decoded;
        return next();
    }
    catch (error) {
        return res.status(401).json({ detail: 'Invalid token' });
    }
};
exports.authenticateJWT = authenticateJWT;
const requireRoles = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ detail: 'Authentication required' });
        }
        const userRole = req.user.role;
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ detail: 'Insufficient permissions' });
        }
        return next();
    };
};
exports.requireRoles = requireRoles;
exports.requireAnyRole = (0, exports.requireRoles)([
    UserRole.STUDENTS,
    UserRole.STAFFS,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
]);
exports.requireAdminRole = (0, exports.requireRoles)([
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
]);
//# sourceMappingURL=auth.js.map