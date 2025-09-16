"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.departmentService = void 0;
const Department_1 = require("../models/Department");
const mongodb_1 = require("../lib/mongodb");
class DepartmentService {
    async ensureDepartmentExists(departmentName) {
        if (!departmentName || typeof departmentName !== 'string') {
            return null;
        }
        const cleanName = departmentName.toLowerCase().trim();
        if (!cleanName)
            return null;
        try {
            return await Department_1.Department.findOrCreate(cleanName, departmentName.trim());
        }
        catch (error) {
            console.error(`DepartmentService: Failed to ensure department exists: ${cleanName}`, error);
            return null;
        }
    }
    async getAllDepartments(includeInactive = false) {
        try {
            const query = includeInactive ? {} : { isActive: true };
            const departments = await Department_1.Department.find(query)
                .sort({ level: 1, name: 1 })
                .populate('subdepartments')
                .lean();
            return departments;
        }
        catch (error) {
            console.error('DepartmentService: Failed to get all departments', error);
            throw error;
        }
    }
    async getDepartmentById(id) {
        try {
            const department = await Department_1.Department.findById(id)
                .populate('subdepartments')
                .lean();
            return department;
        }
        catch (error) {
            console.error(`DepartmentService: Failed to get department by ID: ${id}`, error);
            throw error;
        }
    }
    async getDepartmentByName(name) {
        try {
            const cleanName = name.toLowerCase().trim();
            const department = await Department_1.Department.findOne({ name: cleanName })
                .populate('subdepartments')
                .lean();
            return department;
        }
        catch (error) {
            console.error(`DepartmentService: Failed to get department by name: ${name}`, error);
            throw error;
        }
    }
    async getDepartmentStats() {
        try {
            const db = (0, mongodb_1.getDatabase)();
            if (!db)
                throw new Error('Database not connected');
            const [totalDepartments, activeDepartments, departmentUserCounts] = await Promise.all([
                Department_1.Department.countDocuments({}),
                Department_1.Department.countDocuments({ isActive: true }),
                Department_1.Department.aggregate([
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
            const topDepartments = await Department_1.Department.find({ isActive: true })
                .sort({ userCount: -1 })
                .limit(10)
                .select('name displayName userCount')
                .lean();
            const emptyDepartments = await Department_1.Department.countDocuments({
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
        }
        catch (error) {
            console.error('DepartmentService: Failed to get department stats', error);
            throw error;
        }
    }
    async updateDepartment(id, updateData) {
        try {
            delete updateData._id;
            delete updateData.created;
            delete updateData.userCount;
            const department = await Department_1.Department.findByIdAndUpdate(id, { ...updateData, updated: new Date() }, { new: true, runValidators: true });
            return department;
        }
        catch (error) {
            console.error(`DepartmentService: Failed to update department: ${id}`, error);
            throw error;
        }
    }
    async createDepartment(departmentData) {
        try {
            const department = new Department_1.Department({
                ...departmentData,
                userCount: 0,
                created: new Date(),
                updated: new Date()
            });
            await department.save();
            return department;
        }
        catch (error) {
            console.error('DepartmentService: Failed to create department', error);
            throw error;
        }
    }
    async deleteDepartment(id) {
        try {
            const db = (0, mongodb_1.getDatabase)();
            if (!db)
                throw new Error('Database not connected');
            const department = await Department_1.Department.findById(id);
            if (!department) {
                throw new Error('Department not found');
            }
            if (department.userCount > 0) {
                throw new Error('Cannot delete department with active users');
            }
            department.isActive = false;
            department.updated = new Date();
            await department.save();
            return { success: true, message: 'Department deactivated successfully' };
        }
        catch (error) {
            console.error(`DepartmentService: Failed to delete department: ${id}`, error);
            throw error;
        }
    }
    async recalculateAllUserCounts() {
        try {
            await Department_1.Department.recalculateUserCounts();
            return { success: true, message: 'User counts recalculated successfully' };
        }
        catch (error) {
            console.error('DepartmentService: Failed to recalculate user counts', error);
            throw error;
        }
    }
    async onUserCreated(departmentName) {
        if (!departmentName)
            return;
        try {
            await this.ensureDepartmentExists(departmentName);
            await Department_1.Department.incrementUserCount(departmentName);
        }
        catch (error) {
            console.error(`DepartmentService: Failed to handle user creation for department: ${departmentName}`, error);
        }
    }
    async onUserDeleted(departmentName) {
        if (!departmentName)
            return;
        try {
            await Department_1.Department.decrementUserCount(departmentName);
        }
        catch (error) {
            console.error(`DepartmentService: Failed to handle user deletion for department: ${departmentName}`, error);
        }
    }
    async onUserDepartmentChanged(oldDepartment, newDepartment) {
        try {
            if (oldDepartment) {
                await Department_1.Department.decrementUserCount(oldDepartment);
            }
            if (newDepartment) {
                await this.ensureDepartmentExists(newDepartment);
                await Department_1.Department.incrementUserCount(newDepartment);
            }
        }
        catch (error) {
            console.error(`DepartmentService: Failed to handle department change from ${oldDepartment} to ${newDepartment}`, error);
        }
    }
}
exports.departmentService = new DepartmentService();
//# sourceMappingURL=departmentService.js.map