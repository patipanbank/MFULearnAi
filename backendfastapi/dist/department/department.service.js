"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DepartmentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const department_model_1 = require("../models/department.model");
let DepartmentService = DepartmentService_1 = class DepartmentService {
    departmentModel;
    logger = new common_1.Logger(DepartmentService_1.name);
    constructor(departmentModel) {
        this.departmentModel = departmentModel;
    }
    async getAllDepartments() {
        try {
            const departments = await this.departmentModel.find({}).sort({ name: 1 }).exec();
            return departments;
        }
        catch (error) {
            this.logger.error(`Error getting all departments: ${error}`);
            return [];
        }
    }
    async getDepartmentById(id) {
        try {
            const department = await this.departmentModel.findById(id).exec();
            return department;
        }
        catch (error) {
            this.logger.error(`Error getting department by ID: ${error}`);
            return null;
        }
    }
    async getDepartmentByName(name) {
        try {
            const normalizedName = name.toLowerCase().trim();
            const department = await this.departmentModel.findOne({ name: normalizedName }).exec();
            return department;
        }
        catch (error) {
            this.logger.error(`Error getting department by name: ${error}`);
            return null;
        }
    }
    async createDepartment(departmentData) {
        try {
            const normalizedName = departmentData.name.toLowerCase().trim();
            const department = new this.departmentModel({
                ...departmentData,
                name: normalizedName,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            const savedDepartment = await department.save();
            return savedDepartment;
        }
        catch (error) {
            if (error.code === 11000) {
                throw new Error('Department with this name already exists');
            }
            this.logger.error(`Error creating department: ${error}`);
            throw new Error(`Failed to create department: ${error.message}`);
        }
    }
    async updateDepartment(id, departmentData) {
        try {
            const updateData = {};
            if (departmentData.name !== undefined) {
                updateData.name = departmentData.name.toLowerCase().trim();
            }
            if (departmentData.description !== undefined) {
                updateData.description = departmentData.description;
            }
            if (Object.keys(updateData).length === 0) {
                throw new Error('No fields to update');
            }
            updateData.updatedAt = new Date();
            const updatedDepartment = await this.departmentModel
                .findByIdAndUpdate(id, updateData, { new: true })
                .exec();
            return updatedDepartment;
        }
        catch (error) {
            if (error.code === 11000) {
                throw new Error('Department with this name already exists');
            }
            this.logger.error(`Error updating department: ${error}`);
            throw new Error(`Failed to update department: ${error.message}`);
        }
    }
    async deleteDepartment(id) {
        try {
            const deletedDepartment = await this.departmentModel.findByIdAndDelete(id).exec();
            return deletedDepartment;
        }
        catch (error) {
            this.logger.error(`Error deleting department: ${error}`);
            return null;
        }
    }
    async ensureDepartmentExists(departmentName) {
        if (!departmentName || typeof departmentName !== 'string') {
            throw new Error('Invalid department name');
        }
        const normalizedName = departmentName.toLowerCase().trim();
        if (!normalizedName) {
            throw new Error('Department name cannot be empty');
        }
        try {
            const existingDepartment = await this.getDepartmentByName(normalizedName);
            if (existingDepartment) {
                return existingDepartment;
            }
            const newDepartment = await this.createDepartment({
                name: normalizedName,
                description: `Automatically created department for ${departmentName}`,
            });
            this.logger.log(`✅ Created new department: ${departmentName}`);
            return newDepartment;
        }
        catch (error) {
            this.logger.error(`❌ Error in ensureDepartmentExists: ${error.message}`);
            throw new Error(`Failed to ensure department exists: ${error.message}`);
        }
    }
    async getDepartmentsByUser(userId) {
        try {
            return this.getAllDepartments();
        }
        catch (error) {
            this.logger.error(`Error getting departments by user: ${error}`);
            return [];
        }
    }
    async validateDepartmentName(name) {
        try {
            const normalizedName = name.toLowerCase().trim();
            const existingDepartment = await this.getDepartmentByName(normalizedName);
            return !existingDepartment;
        }
        catch (error) {
            this.logger.error(`Error validating department name: ${error}`);
            return false;
        }
    }
};
exports.DepartmentService = DepartmentService;
exports.DepartmentService = DepartmentService = DepartmentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(department_model_1.Department.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], DepartmentService);
//# sourceMappingURL=department.service.js.map