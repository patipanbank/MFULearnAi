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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentController = void 0;
const common_1 = require("@nestjs/common");
const department_service_1 = require("./department.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const role_guard_1 = require("../auth/guards/role.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const user_model_1 = require("../models/user.model");
let DepartmentController = class DepartmentController {
    departmentService;
    constructor(departmentService) {
        this.departmentService = departmentService;
    }
    async getAllDepartments() {
        try {
            const departments = await this.departmentService.getAllDepartments();
            return {
                success: true,
                data: departments,
                message: 'Departments retrieved successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to get departments: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getDepartmentById(id) {
        try {
            const department = await this.departmentService.getDepartmentById(id);
            if (!department) {
                throw new common_1.HttpException('Department not found', common_1.HttpStatus.NOT_FOUND);
            }
            return {
                success: true,
                data: department,
                message: 'Department retrieved successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to get department: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createDepartment(body) {
        try {
            const { name, description } = body;
            if (!name) {
                throw new common_1.HttpException('Department name is required', common_1.HttpStatus.BAD_REQUEST);
            }
            const department = await this.departmentService.createDepartment({
                name,
                description,
            });
            return {
                success: true,
                data: department,
                message: 'Department created successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to create department: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async updateDepartment(id, body) {
        try {
            const department = await this.departmentService.updateDepartment(id, body);
            if (!department) {
                throw new common_1.HttpException('Department not found', common_1.HttpStatus.NOT_FOUND);
            }
            return {
                success: true,
                data: department,
                message: 'Department updated successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to update department: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async deleteDepartment(id) {
        try {
            const department = await this.departmentService.deleteDepartment(id);
            if (!department) {
                throw new common_1.HttpException('Department not found', common_1.HttpStatus.NOT_FOUND);
            }
            return {
                success: true,
                data: department,
                message: 'Department deleted successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to delete department: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getDepartmentByName(name) {
        try {
            const department = await this.departmentService.getDepartmentByName(name);
            if (!department) {
                throw new common_1.HttpException('Department not found', common_1.HttpStatus.NOT_FOUND);
            }
            return {
                success: true,
                data: department,
                message: 'Department retrieved successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to get department: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async ensureDepartmentExists(body) {
        try {
            const { name } = body;
            if (!name) {
                throw new common_1.HttpException('Department name is required', common_1.HttpStatus.BAD_REQUEST);
            }
            const department = await this.departmentService.ensureDepartmentExists(name);
            return {
                success: true,
                data: department,
                message: 'Department ensured successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to ensure department: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async validateDepartmentName(name) {
        try {
            const isValid = await this.departmentService.validateDepartmentName(name);
            return {
                success: true,
                data: { isValid, name },
                message: 'Department name validation completed',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to validate department name: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.DepartmentController = DepartmentController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DepartmentController.prototype, "getAllDepartments", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DepartmentController.prototype, "getDepartmentById", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(role_guard_1.RoleGuard),
    (0, roles_decorator_1.Roles)(user_model_1.UserRole.ADMIN, user_model_1.UserRole.SUPER_ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DepartmentController.prototype, "createDepartment", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.UseGuards)(role_guard_1.RoleGuard),
    (0, roles_decorator_1.Roles)(user_model_1.UserRole.ADMIN, user_model_1.UserRole.SUPER_ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DepartmentController.prototype, "updateDepartment", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(role_guard_1.RoleGuard),
    (0, roles_decorator_1.Roles)(user_model_1.UserRole.ADMIN, user_model_1.UserRole.SUPER_ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DepartmentController.prototype, "deleteDepartment", null);
__decorate([
    (0, common_1.Get)('name/:name'),
    __param(0, (0, common_1.Param)('name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DepartmentController.prototype, "getDepartmentByName", null);
__decorate([
    (0, common_1.Post)('ensure'),
    (0, common_1.UseGuards)(role_guard_1.RoleGuard),
    (0, roles_decorator_1.Roles)(user_model_1.UserRole.ADMIN, user_model_1.UserRole.SUPER_ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DepartmentController.prototype, "ensureDepartmentExists", null);
__decorate([
    (0, common_1.Get)('validate/:name'),
    __param(0, (0, common_1.Param)('name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DepartmentController.prototype, "validateDepartmentName", null);
exports.DepartmentController = DepartmentController = __decorate([
    (0, common_1.Controller)('department'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [department_service_1.DepartmentService])
], DepartmentController);
//# sourceMappingURL=department.controller.js.map