"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminMiddleware = exports.superAdminMiddleware = exports.departmentMiddleware = void 0;
const user_1 = require("../models/user");
const departmentMiddleware = (req, res, next) => {
    try {
        if (!req.user) {
            res.status(403).json({ error: 'Authentication required' });
            return;
        }
        if (req.user.role !== user_1.UserRole.STAFFS &&
            req.user.role !== user_1.UserRole.ADMIN &&
            req.user.role !== user_1.UserRole.SUPER_ADMIN) {
            res.status(403).json({ error: 'Staff level privileges required' });
            return;
        }
        next();
    }
    catch (error) {
        console.error('Department middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.departmentMiddleware = departmentMiddleware;
const superAdminMiddleware = (req, res, next) => {
    try {
        if (!req.user) {
            res.status(403).json({ error: 'Authentication required' });
            return;
        }
        if (req.user.role !== user_1.UserRole.SUPER_ADMIN) {
            res.status(403).json({ error: 'Super Admin privileges required' });
            return;
        }
        next();
    }
    catch (error) {
        console.error('Super Admin middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.superAdminMiddleware = superAdminMiddleware;
exports.adminMiddleware = exports.departmentMiddleware;
//# sourceMappingURL=adminMiddleware.js.map