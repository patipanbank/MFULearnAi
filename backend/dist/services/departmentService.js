"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.departmentService = exports.DepartmentService = void 0;
const mongodb_1 = require("../lib/mongodb");
const department_1 = require("../models/department");
class DepartmentService {
    constructor() {
        this.db = (0, mongodb_1.getConnection)();
        console.log('✅ Department service initialized');
    }
    async getAllDepartments() {
        try {
            return await department_1.Department.find().sort({ name: 1 });
        }
        catch (error) {
            console.error('❌ Error getting departments:', error);
            return [];
        }
    }
    async getDepartmentById(id) {
        try {
            return await department_1.Department.findById(id);
        }
        catch (error) {
            console.error('❌ Error getting department:', error);
            return null;
        }
    }
    async createDepartment(departmentData) {
        try {
            const department = new department_1.Department(departmentData);
            await department.save();
            return department;
        }
        catch (error) {
            console.error('❌ Error creating department:', error);
            return null;
        }
    }
    async updateDepartment(id, updateData) {
        try {
            return await department_1.Department.findByIdAndUpdate(id, updateData, { new: true });
        }
        catch (error) {
            console.error('❌ Error updating department:', error);
            return null;
        }
    }
    async deleteDepartment(id) {
        try {
            const result = await department_1.Department.findByIdAndDelete(id);
            return !!result;
        }
        catch (error) {
            console.error('❌ Error deleting department:', error);
            return false;
        }
    }
}
exports.DepartmentService = DepartmentService;
exports.departmentService = new DepartmentService();
//# sourceMappingURL=departmentService.js.map