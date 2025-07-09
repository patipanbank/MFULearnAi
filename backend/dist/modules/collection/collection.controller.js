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
const platform_express_1 = require("@nestjs/platform-express");
const collection_service_1 = require("./collection.service");
const create_collection_dto_1 = require("./dto/create-collection.dto");
const update_collection_dto_1 = require("./dto/update-collection.dto");
const jwt_guard_1 = require("../auth/jwt.guard");
const collection_permission_enum_1 = require("./collection-permission.enum");
const document_management_service_1 = require("../../services/document-management.service");
let CollectionController = class CollectionController {
    constructor(collectionService, documentManagementService) {
        this.collectionService = collectionService;
        this.documentManagementService = documentManagementService;
    }
    async list(req) {
        return this.collectionService.getUserCollections(req.user);
    }
    async listPublic() {
        const all = await this.collectionService.getAll();
        return all.filter((c) => c.permission === collection_permission_enum_1.CollectionPermission.PUBLIC);
    }
    async create(dto, req) {
        return this.collectionService.create(dto, req.user);
    }
    async update(id, dto, req) {
        const col = await this.collectionService.findById(id);
        if (!col) {
            throw new Error('Collection not found');
        }
        if (!this.collectionService.canUserModify(req.user, col)) {
            throw new Error('Not authorized');
        }
        return this.collectionService.update(id, dto);
    }
    async remove(id, req) {
        const col = await this.collectionService.findById(id);
        if (!col) {
            throw new Error('Collection not found');
        }
        if (!this.collectionService.canUserModify(req.user, col)) {
            throw new Error('Not authorized');
        }
        await this.collectionService.remove(id);
        return { message: 'Collection deleted' };
    }
    async uploadDocument(collectionId, file, req) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        const collection = await this.collectionService.findById(collectionId);
        if (!collection) {
            throw new common_1.BadRequestException('Collection not found');
        }
        if (!this.collectionService.canUserModify(req.user, collection)) {
            throw new common_1.ForbiddenException('Not authorized to upload to this collection');
        }
        const result = await this.documentManagementService.uploadDocument(collectionId, file, req.user.username);
        return {
            message: 'Document uploaded successfully',
            data: result
        };
    }
    async searchDocuments(collectionId, query, limit = '10', minSimilarity = '0.7', req) {
        const collection = await this.collectionService.findById(collectionId);
        if (!collection) {
            throw new common_1.BadRequestException('Collection not found');
        }
        if (!this.collectionService.canUserAccess(req.user, collection)) {
            throw new common_1.ForbiddenException('Not authorized to access this collection');
        }
        if (!query || query.trim().length === 0) {
            throw new common_1.BadRequestException('Search query is required');
        }
        const results = await this.documentManagementService.searchDocuments(collectionId, query.trim(), parseInt(limit, 10), parseFloat(minSimilarity));
        return {
            message: 'Search completed successfully',
            data: results
        };
    }
    async getDocuments(collectionId, limit = '50', req) {
        const collection = await this.collectionService.findById(collectionId);
        if (!collection) {
            throw new common_1.BadRequestException('Collection not found');
        }
        if (!this.collectionService.canUserAccess(req.user, collection)) {
            throw new common_1.ForbiddenException('Not authorized to access this collection');
        }
        const documents = await this.documentManagementService.getDocuments(collectionId, parseInt(limit, 10));
        return {
            message: 'Documents retrieved successfully',
            data: documents
        };
    }
    async deleteDocument(collectionId, documentId, req) {
        const collection = await this.collectionService.findById(collectionId);
        if (!collection) {
            throw new common_1.BadRequestException('Collection not found');
        }
        if (!this.collectionService.canUserModify(req.user, collection)) {
            throw new common_1.ForbiddenException('Not authorized to delete from this collection');
        }
        await this.documentManagementService.deleteDocument(collectionId, documentId);
        return {
            message: 'Document deleted successfully'
        };
    }
    async getCollectionStats(collectionId, req) {
        const collection = await this.collectionService.findById(collectionId);
        if (!collection) {
            throw new common_1.BadRequestException('Collection not found');
        }
        if (!this.collectionService.canUserAccess(req.user, collection)) {
            throw new common_1.ForbiddenException('Not authorized to access this collection');
        }
        const stats = await this.documentManagementService.getCollectionStats(collectionId);
        return {
            message: 'Collection statistics retrieved successfully',
            data: {
                collection: {
                    id: collection._id,
                    name: collection.name,
                    permission: collection.permission,
                    createdBy: collection.createdBy,
                    department: collection.department,
                    createdAt: collection.createdAt,
                    updatedAt: collection.updatedAt
                },
                documents: stats
            }
        };
    }
};
exports.CollectionController = CollectionController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('public'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "listPublic", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_collection_dto_1.CreateCollectionDto, Object]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_collection_dto_1.UpdateCollectionDto, Object]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/documents'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "uploadDocument", null);
__decorate([
    (0, common_1.Get)(':id/search'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('similarity')),
    __param(4, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "searchDocuments", null);
__decorate([
    (0, common_1.Get)(':id/documents'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "getDocuments", null);
__decorate([
    (0, common_1.Delete)(':id/documents/:documentId'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('documentId')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "deleteDocument", null);
__decorate([
    (0, common_1.Get)(':id/stats'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CollectionController.prototype, "getCollectionStats", null);
exports.CollectionController = CollectionController = __decorate([
    (0, common_1.Controller)({
        path: 'collections',
        version: '1'
    }),
    __metadata("design:paramtypes", [collection_service_1.CollectionService,
        document_management_service_1.DocumentManagementService])
], CollectionController);
//# sourceMappingURL=collection.controller.js.map