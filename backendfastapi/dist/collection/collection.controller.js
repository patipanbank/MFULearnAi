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
exports.CollectionController = void 0;
const common_1 = require("@nestjs/common");
const collection_service_1 = require("./collection.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const role_guard_1 = require("../auth/guards/role.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const user_model_1 = require("../models/user.model");
let CollectionController = class CollectionController {
    collectionService;
    constructor(collectionService) {
        this.collectionService = collectionService;
    }
    async getAllCollections(req) {
        try {
            const user = req.user;
            let collections;
            if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
                collections = await this.collectionService.getAllCollections();
            }
            else {
                collections = await this.collectionService.getUserCollections(user);
            }
            return {
                success: true,
                data: collections,
                message: 'Collections retrieved successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to get collections: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getCollectionById(id, req) {
        try {
            const user = req.user;
            const collection = await this.collectionService.getCollectionById(id);
            if (!collection) {
                throw new common_1.HttpException('Collection not found', common_1.HttpStatus.NOT_FOUND);
            }
            if (!this.collectionService.canUserAccessCollection(user, collection)) {
                throw new common_1.HttpException('Access denied', common_1.HttpStatus.FORBIDDEN);
            }
            return {
                success: true,
                data: collection,
                message: 'Collection retrieved successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to get collection: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createCollection(body, req) {
        try {
            const user = req.user;
            const { name, permission, modelId } = body;
            if (!name || !permission) {
                throw new common_1.HttpException('Name and permission are required', common_1.HttpStatus.BAD_REQUEST);
            }
            const collection = await this.collectionService.createCollection(name, permission, user, modelId);
            return {
                success: true,
                data: collection,
                message: 'Collection created successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to create collection: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async updateCollection(id, body, req) {
        try {
            const user = req.user;
            const collection = await this.collectionService.getCollectionById(id);
            if (!collection) {
                throw new common_1.HttpException('Collection not found', common_1.HttpStatus.NOT_FOUND);
            }
            if (!this.collectionService.canUserModifyCollection(user, collection)) {
                throw new common_1.HttpException('Access denied', common_1.HttpStatus.FORBIDDEN);
            }
            const updatedCollection = await this.collectionService.updateCollection(id, body);
            if (!updatedCollection) {
                throw new common_1.HttpException('Failed to update collection', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
            }
            return {
                success: true,
                data: updatedCollection,
                message: 'Collection updated successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to update collection: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async deleteCollection(id, req) {
        try {
            const user = req.user;
            const collection = await this.collectionService.getCollectionById(id);
            if (!collection) {
                throw new common_1.HttpException('Collection not found', common_1.HttpStatus.NOT_FOUND);
            }
            if (!this.collectionService.canUserModifyCollection(user, collection)) {
                throw new common_1.HttpException('Access denied', common_1.HttpStatus.FORBIDDEN);
            }
            const deleted = await this.collectionService.deleteCollection(id);
            if (!deleted) {
                throw new common_1.HttpException('Failed to delete collection', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
            }
            return {
                success: true,
                message: 'Collection deleted successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to delete collection: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getUserCollections(req) {
        try {
            const user = req.user;
            const collections = await this.collectionService.getUserCollections(user);
            return {
                success: true,
                data: collections,
                message: 'User collections retrieved successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to get user collections: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getCollectionsByDepartment(department) {
        try {
            const collections = await this.collectionService.getCollectionsByDepartment(department);
            return {
                success: true,
                data: collections,
                message: 'Department collections retrieved successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to get department collections: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getCollectionsByCreator(username) {
        try {
            const collections = await this.collectionService.getCollectionsByCreator(username);
            return {
                success: true,
                data: collections,
                message: 'Creator collections retrieved successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to get creator collections: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.CollectionController = CollectionController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "getAllCollections", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "getCollectionById", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "createCollection", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "updateCollection", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "deleteCollection", null);
__decorate([
    (0, common_1.Get)('user/collections'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "getUserCollections", null);
__decorate([
    (0, common_1.Get)('department/:department'),
    (0, common_1.UseGuards)(role_guard_1.RoleGuard),
    (0, roles_decorator_1.Roles)(user_model_1.UserRole.ADMIN, user_model_1.UserRole.SUPER_ADMIN),
    __param(0, (0, common_1.Param)('department')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "getCollectionsByDepartment", null);
__decorate([
    (0, common_1.Get)('creator/:username'),
    (0, common_1.UseGuards)(role_guard_1.RoleGuard),
    (0, roles_decorator_1.Roles)(user_model_1.UserRole.ADMIN, user_model_1.UserRole.SUPER_ADMIN),
    __param(0, (0, common_1.Param)('username')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "getCollectionsByCreator", null);
exports.CollectionController = CollectionController = __decorate([
    (0, common_1.Controller)('collection'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [collection_service_1.CollectionService])
], CollectionController);
//# sourceMappingURL=collection.controller.js.map