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
var CollectionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionService = exports.CollectionPermission = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const collection_model_1 = require("../models/collection.model");
const user_model_1 = require("../models/user.model");
var CollectionPermission;
(function (CollectionPermission) {
    CollectionPermission["PUBLIC"] = "PUBLIC";
    CollectionPermission["DEPARTMENT"] = "DEPARTMENT";
    CollectionPermission["PRIVATE"] = "PRIVATE";
})(CollectionPermission || (exports.CollectionPermission = CollectionPermission = {}));
let CollectionService = CollectionService_1 = class CollectionService {
    collectionModel;
    userModel;
    logger = new common_1.Logger(CollectionService_1.name);
    constructor(collectionModel, userModel) {
        this.collectionModel = collectionModel;
        this.userModel = userModel;
    }
    async getAllCollections() {
        try {
            const collections = await this.collectionModel.find({}).exec();
            return collections;
        }
        catch (error) {
            this.logger.error(`Error getting all collections: ${error}`);
            return [];
        }
    }
    async getCollectionById(collectionId) {
        try {
            const collection = await this.collectionModel.findById(collectionId).exec();
            return collection;
        }
        catch (error) {
            this.logger.error(`Error getting collection by ID: ${error}`);
            return null;
        }
    }
    async createCollection(name, permission, createdBy, modelId) {
        try {
            if (!name || !name.trim()) {
                throw new Error('Collection name cannot be empty');
            }
            name = name.trim();
            if (name.length < 3) {
                throw new Error('Collection name must be at least 3 characters long');
            }
            if (name.length > 100) {
                throw new Error('Collection name cannot exceed 100 characters');
            }
            if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
                throw new Error('Collection name can only contain letters, numbers, spaces, hyphens, and underscores');
            }
            const existingCollection = await this.collectionModel.findOne({ name }).exec();
            if (existingCollection) {
                throw new Error(`Collection with name '${name}' already exists`);
            }
            const collectionData = {
                name,
                permission,
                createdBy: createdBy.username,
                department: createdBy.department || '',
                createdAt: new Date().toISOString(),
            };
            if (modelId) {
                collectionData.modelId = modelId;
            }
            const collection = new this.collectionModel(collectionData);
            const savedCollection = await collection.save();
            return savedCollection;
        }
        catch (error) {
            this.logger.error(`Error creating collection: ${error}`);
            throw new Error(`Failed to create collection: ${error.message}`);
        }
    }
    async updateCollection(collectionId, updates) {
        try {
            const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([_, value]) => value !== undefined));
            if (Object.keys(cleanUpdates).length === 0) {
                return this.getCollectionById(collectionId);
            }
            const collection = await this.collectionModel
                .findByIdAndUpdate(collectionId, cleanUpdates, { new: true })
                .exec();
            return collection;
        }
        catch (error) {
            this.logger.error(`Error updating collection: ${error}`);
            return null;
        }
    }
    async deleteCollection(collectionId) {
        try {
            const result = await this.collectionModel.findByIdAndDelete(collectionId).exec();
            return !!result;
        }
        catch (error) {
            this.logger.error(`Error deleting collection: ${error}`);
            return false;
        }
    }
    async getUserCollections(user) {
        try {
            const query = {
                $or: [
                    { permission: CollectionPermission.PUBLIC },
                    { permission: CollectionPermission.DEPARTMENT, department: user.department || '' },
                    { permission: CollectionPermission.PRIVATE, createdBy: user.username },
                ],
            };
            const collections = await this.collectionModel.find(query).exec();
            return collections;
        }
        catch (error) {
            this.logger.error(`Error getting user collections: ${error}`);
            return [];
        }
    }
    canUserAccessCollection(user, collection) {
        if (collection.permission === CollectionPermission.PUBLIC) {
            return true;
        }
        if (collection.permission === CollectionPermission.PRIVATE) {
            return collection.createdBy === user.username;
        }
        if (collection.permission === CollectionPermission.DEPARTMENT) {
            return (collection.createdBy === user.username ||
                user.department === collection.department);
        }
        if (user.role === user_model_1.UserRole.ADMIN || user.role === user_model_1.UserRole.SUPER_ADMIN) {
            return true;
        }
        return false;
    }
    canUserModifyCollection(user, collection) {
        if (collection.permission === CollectionPermission.PRIVATE) {
            return collection.createdBy === user.username;
        }
        if (collection.permission === CollectionPermission.PUBLIC) {
            return user.role === user_model_1.UserRole.ADMIN || user.role === user_model_1.UserRole.SUPER_ADMIN;
        }
        if (collection.permission === CollectionPermission.DEPARTMENT) {
            return collection.createdBy === user.username;
        }
        if (user.role === user_model_1.UserRole.ADMIN || user.role === user_model_1.UserRole.SUPER_ADMIN) {
            return true;
        }
        return false;
    }
    async getCollectionsByDepartment(department) {
        try {
            const collections = await this.collectionModel
                .find({
                $or: [
                    { permission: CollectionPermission.PUBLIC },
                    { permission: CollectionPermission.DEPARTMENT, department },
                ],
            })
                .exec();
            return collections;
        }
        catch (error) {
            this.logger.error(`Error getting collections by department: ${error}`);
            return [];
        }
    }
    async getCollectionsByCreator(username) {
        try {
            const collections = await this.collectionModel
                .find({ createdBy: username })
                .exec();
            return collections;
        }
        catch (error) {
            this.logger.error(`Error getting collections by creator: ${error}`);
            return [];
        }
    }
};
exports.CollectionService = CollectionService;
exports.CollectionService = CollectionService = CollectionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(collection_model_1.Collection.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_model_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], CollectionService);
//# sourceMappingURL=collection.service.js.map