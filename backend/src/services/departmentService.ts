import { Department, IDepartment } from '../models/Department';
import { getDatabase } from '../lib/mongodb';
import mongoose from 'mongoose';

class DepartmentService {
  async ensureDepartmentExists(departmentName: string, displayName?: string): Promise<IDepartment | null> {
    if (!departmentName || typeof departmentName !== 'string') {
      return null;
    }

    const cleanName = departmentName.toLowerCase().trim();
    if (!cleanName) return null;

    try {
      // Use the static method from the model
      const department = await Department.findOrCreate(cleanName, displayName || departmentName.trim());

      if (department) {
        console.log(`📁 Department ensured: ${cleanName} (${department.displayName})`);
      }

      return department;
    } catch (error) {
      console.error(`DepartmentService: Failed to ensure department exists: ${cleanName}`, error);
      return null;
    }
  }

  async getAllDepartments(includeInactive: boolean = false) {
    try {
      const query = includeInactive ? {} : { isActive: true };

      const departments = await Department.find(query)
        .sort({ level: 1, name: 1 })
        .populate('subdepartments')
        .lean();

      return departments;
    } catch (error) {
      console.error('DepartmentService: Failed to get all departments', error);
      throw error;
    }
  }

  async getDepartmentById(id: string) {
    try {
      const department = await Department.findById(id)
        .populate('subdepartments')
        .lean();

      return department;
    } catch (error) {
      console.error(`DepartmentService: Failed to get department by ID: ${id}`, error);
      throw error;
    }
  }

  async getDepartmentByName(name: string) {
    try {
      const cleanName = name.toLowerCase().trim();
      const department = await Department.findOne({ name: cleanName })
        .populate('subdepartments')
        .lean();

      return department;
    } catch (error) {
      console.error(`DepartmentService: Failed to get department by name: ${name}`, error);
      throw error;
    }
  }

  async getDepartmentStats() {
    try {
      const db = getDatabase();
      if (!db) throw new Error('Database not connected');

      const [totalDepartments, activeDepartments, departmentUserCounts] = await Promise.all([
        Department.countDocuments({}),
        Department.countDocuments({ isActive: true }),
        Department.aggregate([
          { $match: { isActive: true } },
          {
            $group: {
              _id: null,
              totalUsers: { $sum: '$userCount' },
              avgUsersPerDept: { $avg: '$userCount' },
              maxUsers: { $max: '$userCount' },
              minUsers: { $min: '$userCount' }
            }
          }
        ])
      ]);

      // Get departments with highest user counts
      const topDepartments = await Department.find({ isActive: true })
        .sort({ userCount: -1 })
        .limit(10)
        .select('name displayName userCount')
        .lean();

      // Get departments with no users
      const emptyDepartments = await Department.countDocuments({
        isActive: true,
        userCount: 0
      });

      const stats = departmentUserCounts[0] || {
        totalUsers: 0,
        avgUsersPerDept: 0,
        maxUsers: 0,
        minUsers: 0
      };

      return {
        totalDepartments,
        activeDepartments,
        emptyDepartments,
        userStats: {
          totalUsers: stats.totalUsers,
          averageUsersPerDepartment: Math.round(stats.avgUsersPerDept || 0),
          maxUsersInDepartment: stats.maxUsers,
          minUsersInDepartment: stats.minUsers
        },
        topDepartments
      };
    } catch (error) {
      console.error('DepartmentService: Failed to get department stats', error);
      throw error;
    }
  }

  async updateDepartment(id: string, updateData: Partial<IDepartment>) {
    try {
      // Remove fields that shouldn't be updated directly
      delete updateData._id;
      delete updateData.created;
      delete updateData.userCount; // This should be managed automatically

      const department = await Department.findByIdAndUpdate(
        id,
        { ...updateData, updated: new Date() },
        { new: true, runValidators: true }
      );

      return department;
    } catch (error) {
      console.error(`DepartmentService: Failed to update department: ${id}`, error);
      throw error;
    }
  }

  async createDepartment(departmentData: Partial<IDepartment>) {
    try {
      const department = new Department({
        ...departmentData,
        userCount: 0,
        created: new Date(),
        updated: new Date()
      });

      await department.save();
      return department;
    } catch (error) {
      console.error('DepartmentService: Failed to create department', error);
      throw error;
    }
  }

  async deleteDepartment(id: string) {
    try {
      const db = getDatabase();
      if (!db) throw new Error('Database not connected');

      // Check if department has users
      const department = await Department.findById(id);
      if (!department) {
        throw new Error('Department not found');
      }

      if (department.userCount > 0) {
        throw new Error('Cannot delete department with active users');
      }

      // Soft delete by setting isActive to false
      department.isActive = false;
      department.updated = new Date();
      await department.save();

      return { success: true, message: 'Department deactivated successfully' };
    } catch (error) {
      console.error(`DepartmentService: Failed to delete department: ${id}`, error);
      throw error;
    }
  }

  async recalculateAllUserCounts() {
    try {
      await Department.recalculateUserCounts();
      return { success: true, message: 'User counts recalculated successfully' };
    } catch (error) {
      console.error('DepartmentService: Failed to recalculate user counts', error);
      throw error;
    }
  }

  async onUserCreated(departmentName: string) {
    if (!departmentName) return;

    try {
      // Ensure department exists
      const department = await this.ensureDepartmentExists(departmentName);

      if (department) {
        // Increment user count
        await Department.incrementUserCount(departmentName);
        console.log(`📊 User count incremented for department: ${departmentName}`);
      }
    } catch (error) {
      console.error(`DepartmentService: Failed to handle user creation for department: ${departmentName}`, error);
    }
  }

  async onUserDeleted(departmentName: string) {
    if (!departmentName) return;

    try {
      await Department.decrementUserCount(departmentName);
      console.log(`📊 User count decremented for department: ${departmentName}`);
    } catch (error) {
      console.error(`DepartmentService: Failed to handle user deletion for department: ${departmentName}`, error);
    }
  }

  async onUserDepartmentChanged(oldDepartment: string, newDepartment: string) {
    try {
      if (oldDepartment && oldDepartment !== newDepartment) {
        await Department.decrementUserCount(oldDepartment);
        console.log(`📊 User count decremented for old department: ${oldDepartment}`);
      }

      if (newDepartment && oldDepartment !== newDepartment) {
        await this.ensureDepartmentExists(newDepartment);
        await Department.incrementUserCount(newDepartment);
        console.log(`📊 User count incremented for new department: ${newDepartment}`);
      }

      if (oldDepartment !== newDepartment) {
        console.log(`🔄 User department changed: ${oldDepartment || 'none'} → ${newDepartment || 'none'}`);
      }
    } catch (error) {
      console.error(`DepartmentService: Failed to handle department change from ${oldDepartment} to ${newDepartment}`, error);
    }
  }
}

export const departmentService = new DepartmentService();