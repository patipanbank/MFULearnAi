"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDepartment = exports.updateDepartment = exports.createDepartment = exports.getDepartmentByName = exports.getDepartmentById = exports.getAllDepartments = void 0;
const Department_1 = __importDefault(require("../models/Department"));
// Get all departments
const getAllDepartments = async () => {
    try {
        return await Department_1.default.find().sort({ name: 1 });
    }
    catch (error) {
        throw new Error(`Error fetching departments: ${error.message}`);
    }
};
exports.getAllDepartments = getAllDepartments;
// Get department by ID
const getDepartmentById = async (id) => {
    try {
        const department = await Department_1.default.findById(id);
        return department;
    }
    catch (error) {
        throw new Error(`Error fetching department: ${error.message}`);
    }
};
exports.getDepartmentById = getDepartmentById;
// Get department by name
const getDepartmentByName = async (name) => {
    try {
        const department = await Department_1.default.findOne({ name });
        return department;
    }
    catch (error) {
        throw new Error(`Error fetching department by name: ${error.message}`);
    }
};
exports.getDepartmentByName = getDepartmentByName;
// Create new department
const createDepartment = async (departmentData) => {
    try {
        const department = new Department_1.default(departmentData);
        return await department.save();
    }
    catch (error) {
        if (error.code === 11000) {
            throw new Error('Department with this name already exists');
        }
        throw new Error(`Error creating department: ${error.message}`);
    }
};
exports.createDepartment = createDepartment;
// Update department
const updateDepartment = async (id, departmentData) => {
    try {
        const department = await Department_1.default.findByIdAndUpdate(id, departmentData, { new: true, runValidators: true });
        return department;
    }
    catch (error) {
        if (error.code === 11000) {
            throw new Error('Department with this name already exists');
        }
        throw new Error(`Error updating department: ${error.message}`);
    }
};
exports.updateDepartment = updateDepartment;
// Delete department
const deleteDepartment = async (id) => {
    try {
        const department = await Department_1.default.findByIdAndDelete(id);
        return department;
    }
    catch (error) {
        throw new Error(`Error deleting department: ${error.message}`);
    }
};
exports.deleteDepartment = deleteDepartment;
