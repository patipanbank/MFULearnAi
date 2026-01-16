"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllDepartments = getAllDepartments;
exports.getDepartmentById = getDepartmentById;
exports.getDepartmentByName = getDepartmentByName;
exports.createDepartment = createDepartment;
exports.updateDepartment = updateDepartment;
exports.deleteDepartment = deleteDepartment;
const Department_1 = __importDefault(require("../models/Department"));
const errors_1 = require("../errors");
/**
 * Get all departments
 */
async function getAllDepartments() {
    try {
        return await Department_1.default.find().sort({ name: 1 });
    }
    catch (error) {
        throw new errors_1.InternalError(`Failed to fetch departments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Get department by ID
 */
async function getDepartmentById(id) {
    try {
        const department = await Department_1.default.findById(id);
        return department;
    }
    catch (error) {
        throw new errors_1.InternalError(`Failed to fetch department: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Get department by name
 */
async function getDepartmentByName(name) {
    try {
        const department = await Department_1.default.findOne({ name });
        return department;
    }
    catch (error) {
        throw new errors_1.InternalError(`Failed to fetch department by name: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Create new department
 */
async function createDepartment(departmentData) {
    try {
        const department = new Department_1.default(departmentData);
        return await department.save();
    }
    catch (error) {
        if (error.code === 11000) {
            throw new errors_1.ConflictError('Department with this name already exists');
        }
        throw new errors_1.InternalError(`Failed to create department: ${error.message || 'Unknown error'}`);
    }
}
/**
 * Update department
 */
async function updateDepartment(id, departmentData) {
    try {
        const department = await Department_1.default.findByIdAndUpdate(id, departmentData, {
            new: true,
            runValidators: true,
        });
        return department;
    }
    catch (error) {
        if (error.code === 11000) {
            throw new errors_1.ConflictError('Department with this name already exists');
        }
        throw new errors_1.InternalError(`Failed to update department: ${error.message || 'Unknown error'}`);
    }
}
/**
 * Delete department
 */
async function deleteDepartment(id) {
    try {
        const department = await Department_1.default.findByIdAndDelete(id);
        return department;
    }
    catch (error) {
        throw new errors_1.InternalError(`Failed to delete department: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
