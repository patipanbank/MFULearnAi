"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminMiddleware = void 0;
const user_1 = require("../models/user");
const adminMiddleware = (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (req.user.role !== user_1.UserRole.ADMIN && req.user.role !== user_1.UserRole.SUPER_ADMIN) {
            res.status(403).json({ error: 'Admin privileges required' });
            return;
        }
        next();
    }
    catch (error) {
        console.error('Admin middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.adminMiddleware = adminMiddleware;
//# sourceMappingURL=adminMiddleware.js.map