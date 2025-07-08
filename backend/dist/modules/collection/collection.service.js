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
exports.CollectionService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const collection_permission_enum_1 = require("./collection-permission.enum");
let CollectionService = class CollectionService {
    constructor(collectionModel) {
        this.collectionModel = collectionModel;
    }
    async getAll() {
        return this.collectionModel.find().lean();
    }
    async findById(id) {
        return this.collectionModel.findById(id).lean();
    }
    async create(dto, user) {
        const name = dto.name.trim();
        if (name.length < 3)
            throw new common_1.BadRequestException('Name too short');
        if (name.length > 100)
            throw new common_1.BadRequestException('Name too long');
        const exists = await this.collectionModel.findOne({ name });
        if (exists)
            throw new common_1.ConflictException('Collection with this name already exists');
        const doc = new this.collectionModel({
            name,
            permission: dto.permission,
            createdBy: user.username,
            department: user.department,
            modelId: dto.modelId,
        });
        return doc.save();
    }
    async update(id, dto) {
        const updates = { ...dto };
        if (updates.name) {
            updates.name = updates.name.trim();
        }
        const updated = await this.collectionModel.findByIdAndUpdate(id, { $set: updates }, { new: true, lean: true });
        if (!updated)
            throw new common_1.NotFoundException('Collection not found');
        return updated;
    }
    async remove(id) {
        const deleted = await this.collectionModel.findByIdAndDelete(id);
        if (!deleted)
            throw new common_1.NotFoundException('Collection not found');
    }
    canUserAccess(user, collection) {
        if (collection.permission === collection_permission_enum_1.CollectionPermission.PUBLIC)
            return true;
        if (collection.permission === collection_permission_enum_1.CollectionPermission.PRIVATE) {
            return collection.createdBy === user.username;
        }
        if (collection.permission === collection_permission_enum_1.CollectionPermission.DEPARTMENT) {
            return (collection.createdBy === user.username ||
                (!!user.department && user.department === collection.department));
        }
        return false;
    }
    canUserModify(user, collection) {
        var _a, _b;
        if (!!((_a = user.roles) === null || _a === void 0 ? void 0 : _a.includes('SuperAdmin')) || !!((_b = user.roles) === null || _b === void 0 ? void 0 : _b.includes('Admin')))
            return true;
        return collection.createdBy === user.username;
    }
    async getUserCollections(user) {
        const orQuery = [
            { permission: collection_permission_enum_1.CollectionPermission.PUBLIC },
            { permission: collection_permission_enum_1.CollectionPermission.PRIVATE, createdBy: user.username },
            { permission: collection_permission_enum_1.CollectionPermission.DEPARTMENT, department: user.department },
        ];
        return this.collectionModel.find({ $or: orQuery }).lean();
    }
};
exports.CollectionService = CollectionService;
exports.CollectionService = CollectionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('Collection')),
    __metadata("design:paramtypes", [mongoose_2.Model])
], CollectionService);
//# sourceMappingURL=collection.service.js.map