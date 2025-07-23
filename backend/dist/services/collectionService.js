"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectionService = exports.CollectionService = void 0;
const collection_1 = require("../models/collection");
const user_1 = require("../models/user");
const mongoose_1 = __importDefault(require("mongoose"));
function mapId(doc) {
    if (!doc)
        return doc;
    const obj = doc.toObject ? doc.toObject() : { ...doc };
    obj.id = obj._id?.toString();
    delete obj._id;
    return obj;
}
class CollectionService {
    async getAllCollections() {
        try {
            const docs = await collection_1.Collection.find({}).exec();
            return docs.map(mapId);
        }
        catch (e) {
            return [];
        }
    }
    async getCollectionById(collectionId) {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(collectionId))
                return null;
            const doc = await collection_1.Collection.findById(collectionId).exec();
            return mapId(doc);
        }
        catch (e) {
            return null;
        }
    }
    async createCollection(name, permission, createdBy, modelId) {
        try {
            if (!name || !name.trim())
                throw new Error('Collection name cannot be empty');
            name = name.trim();
            if (name.length < 3)
                throw new Error('Collection name must be at least 3 characters long');
            if (name.length > 100)
                throw new Error('Collection name cannot exceed 100 characters');
            if (!/^[a-zA-Z0-9\s\-_]+$/.test(name))
                throw new Error('Collection name can only contain letters, numbers, spaces, hyphens, and underscores');
            const exists = await collection_1.Collection.findOne({ name });
            if (exists)
                throw new Error(`Collection with name '${name}' already exists`);
            const doc = {
                name,
                permission,
                createdBy: createdBy.username,
                department: createdBy.department,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            if (modelId)
                doc.modelId = modelId;
            const collection = new collection_1.Collection(doc);
            await collection.save();
            return mapId(collection);
        }
        catch (e) {
            throw new Error(e.message || 'Failed to create collection');
        }
    }
    async updateCollection(collectionId, updates) {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(collectionId))
                return null;
            const cleanUpdates = {};
            for (const k in updates) {
                if (updates[k] !== undefined && updates[k] !== null)
                    cleanUpdates[k] = updates[k];
            }
            cleanUpdates.updatedAt = new Date();
            if (Object.keys(cleanUpdates).length === 1 && cleanUpdates.updatedAt) {
                return await this.getCollectionById(collectionId);
            }
            const updated = await collection_1.Collection.findByIdAndUpdate(collectionId, { $set: cleanUpdates }, { new: true }).exec();
            return mapId(updated);
        }
        catch (e) {
            return null;
        }
    }
    async deleteCollection(collectionOrId) {
        try {
            let id = typeof collectionOrId === 'string' ? collectionOrId : collectionOrId?.id || collectionOrId?._id;
            if (!mongoose_1.default.Types.ObjectId.isValid(id))
                return false;
            const result = await collection_1.Collection.deleteOne({ _id: id }).exec();
            return result.deletedCount === 1;
        }
        catch (e) {
            return false;
        }
    }
    async getUserCollections(user) {
        try {
            const docs = await collection_1.Collection.find({
                $or: [
                    { permission: collection_1.CollectionPermission.PUBLIC },
                    { permission: collection_1.CollectionPermission.DEPARTMENT, department: user.department },
                    { permission: collection_1.CollectionPermission.PRIVATE, createdBy: user.username },
                ],
            }).exec();
            return docs.map(mapId);
        }
        catch (e) {
            return [];
        }
    }
    canUserAccessCollection(user, collection) {
        if (collection.permission === collection_1.CollectionPermission.PUBLIC)
            return true;
        if (collection.permission === collection_1.CollectionPermission.PRIVATE)
            return collection.createdBy === user.username;
        if (collection.permission === collection_1.CollectionPermission.DEPARTMENT) {
            return collection.createdBy === user.username || user.department === collection.department;
        }
        if ([user_1.UserRole.ADMIN, user_1.UserRole.SUPER_ADMIN].includes(user.role))
            return true;
        return false;
    }
    canUserModifyCollection(user, collection) {
        if (collection.permission === collection_1.CollectionPermission.PRIVATE)
            return collection.createdBy === user.username;
        if (collection.permission === collection_1.CollectionPermission.PUBLIC)
            return [user_1.UserRole.ADMIN, user_1.UserRole.SUPER_ADMIN].includes(user.role);
        if (collection.permission === collection_1.CollectionPermission.DEPARTMENT)
            return collection.createdBy === user.username;
        if ([user_1.UserRole.ADMIN, user_1.UserRole.SUPER_ADMIN].includes(user.role))
            return true;
        return false;
    }
}
exports.CollectionService = CollectionService;
exports.collectionService = new CollectionService();
//# sourceMappingURL=collectionService.js.map