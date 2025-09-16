"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const adminMiddleware_1 = require("../middleware/adminMiddleware");
const userService_1 = require("../services/userService");
const collectionService_1 = require("../services/collectionService");
const chromaService_1 = require("../services/chromaService");
const mongodb_1 = require("../lib/mongodb");
const user_1 = require("../models/user");
const mongoose_1 = __importDefault(require("mongoose"));
const router = express_1.default.Router();
router.use(auth_1.authenticateJWT, adminMiddleware_1.superAdminMiddleware);
router.get('/users', async (req, res) => {
    try {
        const { role, department, search, page = 1, limit = 20 } = req.query;
        const db = (0, mongodb_1.getDatabase)();
        if (!db)
            throw new Error('Database not connected');
        const query = {};
        if (role && role !== 'all') {
            query.role = role;
        }
        if (department && department !== 'all') {
            query.department = department;
        }
        if (search) {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } }
            ];
        }
        const skip = (Number(page) - 1) * Number(limit);
        const users = await db.collection('users')
            .find(query)
            .sort({ created: -1 })
            .skip(skip)
            .limit(Number(limit))
            .toArray();
        const total = await db.collection('users').countDocuments(query);
        const formattedUsers = users.map(user => ({
            ...user,
            _id: user._id.toString()
        }));
        res.json({
            users: formattedUsers,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
router.get('/users/:userId', async (req, res) => {
    try {
        const user = await userService_1.userService.get_user_by_id(req.params.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.json(user);
    }
    catch (error) {
        console.error('Error fetching user:', error);
        return res.status(500).json({ error: 'Failed to fetch user' });
    }
});
router.put('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;
        const db = (0, mongodb_1.getDatabase)();
        if (!db)
            throw new Error('Database not connected');
        delete updates._id;
        delete updates.created;
        updates.updated = new Date();
        const result = await db.collection('users').findOneAndUpdate({ _id: new mongoose_1.default.Types.ObjectId(userId) }, { $set: updates }, { returnDocument: 'after' });
        if (!result) {
            return res.status(404).json({ error: 'User not found' });
        }
        const formattedResult = {
            ...result,
            _id: result._id.toString()
        };
        return res.json(formattedResult);
    }
    catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({ error: 'Failed to update user' });
    }
});
router.delete('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const db = (0, mongodb_1.getDatabase)();
        if (!db)
            throw new Error('Database not connected');
        if (req.user?._id?.toString() === userId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        const result = await db.collection('users').deleteOne({
            _id: new mongoose_1.default.Types.ObjectId(userId)
        });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ error: 'Failed to delete user' });
    }
});
router.get('/analytics', async (req, res) => {
    try {
        const db = (0, mongodb_1.getDatabase)();
        if (!db)
            throw new Error('Database not connected');
        const userStats = await db.collection('users').aggregate([
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 }
                }
            }
        ]).toArray();
        const totalUsers = await db.collection('users').countDocuments();
        const collections = await collectionService_1.collectionService.getAllCollections();
        let totalDocuments = 0;
        let collectionDetails = [];
        for (const collection of collections) {
            try {
                const documents = await chromaService_1.chromaService.getDocuments(collection.name, 1, 0);
                const docCount = documents.total || 0;
                totalDocuments += docCount;
                collectionDetails.push({
                    name: collection.name,
                    permission: collection.permission,
                    createdBy: collection.createdBy,
                    documentCount: docCount,
                    department: collection.department
                });
            }
            catch (error) {
                console.warn(`Failed to get documents for collection ${collection.name}:`, error);
                collectionDetails.push({
                    name: collection.name,
                    permission: collection.permission,
                    createdBy: collection.createdBy,
                    documentCount: 0,
                    department: collection.department
                });
            }
        }
        const recentUsers = await db.collection('users')
            .find({})
            .sort({ created: -1 })
            .limit(5)
            .toArray();
        res.json({
            userStats: {
                total: totalUsers,
                byRole: userStats.reduce((acc, stat) => {
                    acc[stat._id] = stat.count;
                    return acc;
                }, {})
            },
            collectionStats: {
                total: collections.length,
                totalDocuments,
                collections: collectionDetails
            },
            recentActivity: {
                recentUsers: recentUsers.map(user => ({
                    _id: user._id.toString(),
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    created: user.created
                }))
            }
        });
    }
    catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});
router.get('/departments', async (req, res) => {
    try {
        const db = (0, mongodb_1.getDatabase)();
        if (!db)
            throw new Error('Database not connected');
        const departments = await db.collection('users').distinct('department');
        const departmentStats = await db.collection('users').aggregate([
            {
                $group: {
                    _id: '$department',
                    userCount: { $sum: 1 },
                    roles: { $addToSet: '$role' }
                }
            }
        ]).toArray();
        const departmentData = departments.filter(dept => dept).map(dept => {
            const stats = departmentStats.find(s => s._id === dept);
            return {
                name: dept,
                userCount: stats?.userCount || 0,
                roles: stats?.roles || []
            };
        });
        res.json({ departments: departmentData });
    }
    catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
});
router.get('/system/config', async (req, res) => {
    try {
        const systemConfig = {
            defaultTokenQuota: 10000,
            defaultDailyLimit: 10000,
            allowedRoles: Object.values(user_1.UserRole),
            systemStatus: 'operational'
        };
        res.json(systemConfig);
    }
    catch (error) {
        console.error('Error fetching system config:', error);
        res.status(500).json({ error: 'Failed to fetch system configuration' });
    }
});
router.put('/system/config', async (req, res) => {
    try {
        const { defaultTokenQuota, defaultDailyLimit } = req.body;
        const updatedConfig = {
            defaultTokenQuota: defaultTokenQuota || 10000,
            defaultDailyLimit: defaultDailyLimit || 10000,
            allowedRoles: Object.values(user_1.UserRole),
            systemStatus: 'operational',
            updatedAt: new Date()
        };
        res.json(updatedConfig);
    }
    catch (error) {
        console.error('Error updating system config:', error);
        res.status(500).json({ error: 'Failed to update system configuration' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map