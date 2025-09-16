import express, { Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { superAdminMiddleware, SuperAdminRequest } from '../middleware/adminMiddleware';
import { userService } from '../services/userService';
import { collectionService } from '../services/collectionService';
import { chromaService } from '../services/chromaService';
import { departmentService } from '../services/departmentService';
import { getDatabase } from '../lib/mongodb';
import { User, UserRole, IUser } from '../models/user';
import mongoose from 'mongoose';

const router = express.Router();

// Apply authentication and super admin middleware to all routes
router.use(authenticateJWT, superAdminMiddleware);

// User Management Routes
router.get('/users', async (req: SuperAdminRequest, res: Response) => {
  try {
    const { role, department, search, page = 1, limit = 20 } = req.query;
    const db = getDatabase();
    if (!db) throw new Error('Database not connected');

    // Build query
    const query: any = {};
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

    // Convert ObjectIds to strings
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
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID
router.get('/users/:userId', async (req: SuperAdminRequest, res: Response) => {
  try {
    const user = await userService.get_user_by_id(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user
router.put('/users/:userId', async (req: SuperAdminRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    const db = getDatabase();
    if (!db) throw new Error('Database not connected');

    // Remove fields that shouldn't be updated directly
    delete updates._id;
    delete updates.created;

    // Add updated timestamp
    updates.updated = new Date();

    const result = await db.collection('users').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Convert ObjectId to string
    const formattedResult = {
      ...result,
      _id: result._id.toString()
    };

    return res.json(formattedResult);
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:userId', async (req: SuperAdminRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const db = getDatabase();
    if (!db) throw new Error('Database not connected');

    // Prevent deleting the current super admin
    if (req.user?._id?.toString() === userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Get user before deletion to handle department count
    const userToDelete = await db.collection('users').findOne({
      _id: new mongoose.Types.ObjectId(userId)
    });

    const result = await db.collection('users').deleteOne({
      _id: new mongoose.Types.ObjectId(userId)
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update department user count
    if (userToDelete?.department) {
      await departmentService.onUserDeleted(userToDelete.department);
    }

    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

// System Analytics Routes
router.get('/analytics', async (req: SuperAdminRequest, res: Response) => {
  try {
    const db = getDatabase();
    if (!db) throw new Error('Database not connected');

    // Get user statistics
    const userStats = await db.collection('users').aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const totalUsers = await db.collection('users').countDocuments();

    // Get collection statistics
    const collections = await collectionService.getAllCollections();
    let totalDocuments = 0;
    let collectionDetails = [];

    for (const collection of collections) {
      try {
        const documents = await chromaService.getDocuments(collection.name, 1, 0);
        const docCount = documents.total || 0;
        totalDocuments += docCount;

        collectionDetails.push({
          name: collection.name,
          permission: collection.permission,
          createdBy: collection.createdBy,
          documentCount: docCount,
          department: collection.department
        });
      } catch (error) {
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

    // Get recent activity (optional - can be expanded)
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
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Department Management Routes
router.get('/departments', async (req: SuperAdminRequest, res: Response) => {
  try {
    const { includeInactive = false } = req.query;
    const departments = await departmentService.getAllDepartments(includeInactive === 'true');
    res.json({ departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Get department stats
router.get('/departments/stats', async (req: SuperAdminRequest, res: Response) => {
  try {
    const stats = await departmentService.getDepartmentStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching department stats:', error);
    res.status(500).json({ error: 'Failed to fetch department stats' });
  }
});

// Get department by ID
router.get('/departments/:id', async (req: SuperAdminRequest, res: Response) => {
  try {
    const department = await departmentService.getDepartmentById(req.params.id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    return res.json(department);
  } catch (error) {
    console.error('Error fetching department:', error);
    return res.status(500).json({ error: 'Failed to fetch department' });
  }
});

// Create department
router.post('/departments', async (req: SuperAdminRequest, res: Response) => {
  try {
    const department = await departmentService.createDepartment({
      ...req.body,
      createdBy: req.user?._id
    });
    res.status(201).json(department);
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// Update department
router.put('/departments/:id', async (req: SuperAdminRequest, res: Response) => {
  try {
    const department = await departmentService.updateDepartment(req.params.id, req.body);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    return res.json(department);
  } catch (error) {
    console.error('Error updating department:', error);
    return res.status(500).json({ error: 'Failed to update department' });
  }
});

// Delete department
router.delete('/departments/:id', async (req: SuperAdminRequest, res: Response) => {
  try {
    const result = await departmentService.deleteDepartment(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

// Recalculate user counts
router.post('/departments/recalculate', async (req: SuperAdminRequest, res: Response) => {
  try {
    const result = await departmentService.recalculateAllUserCounts();
    res.json(result);
  } catch (error) {
    console.error('Error recalculating user counts:', error);
    res.status(500).json({ error: 'Failed to recalculate user counts' });
  }
});

// System Configuration Routes
router.get('/system/config', async (req: SuperAdminRequest, res: Response) => {
  try {
    // This can be expanded to include system-wide configuration
    const systemConfig = {
      defaultTokenQuota: 10000,
      defaultDailyLimit: 10000,
      allowedRoles: Object.values(UserRole),
      systemStatus: 'operational'
    };

    res.json(systemConfig);
  } catch (error) {
    console.error('Error fetching system config:', error);
    res.status(500).json({ error: 'Failed to fetch system configuration' });
  }
});

// Update system configuration
router.put('/system/config', async (req: SuperAdminRequest, res: Response) => {
  try {
    const { defaultTokenQuota, defaultDailyLimit } = req.body;

    // For now, just return the updated config
    // In the future, this could be stored in a system config collection
    const updatedConfig = {
      defaultTokenQuota: defaultTokenQuota || 10000,
      defaultDailyLimit: defaultDailyLimit || 10000,
      allowedRoles: Object.values(UserRole),
      systemStatus: 'operational',
      updatedAt: new Date()
    };

    res.json(updatedConfig);
  } catch (error) {
    console.error('Error updating system config:', error);
    res.status(500).json({ error: 'Failed to update system configuration' });
  }
});

export default router;