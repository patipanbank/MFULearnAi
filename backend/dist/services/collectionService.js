"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectionService = exports.CollectionService = void 0;
const collection_1 = require("../models/collection");
class CollectionService {
    constructor() {
        this.model = collection_1.Collection;
        console.log('✅ Collection service initialized');
    }
    async getUserCollections(user) {
        const query = {
            $or: [
                { permission: 'PUBLIC' },
                { permission: 'DEPARTMENT', department: user.department },
                { permission: 'PRIVATE', createdBy: user.username }
            ]
        };
        const collections = await this.model.find(query).exec();
        return collections;
    }
    async getCollectionById(collectionId) {
        return this.model.findById(collectionId).exec();
    }
    canUserModifyCollection(user, collection) {
        if (collection.permission === 'PRIVATE') {
            return collection.createdBy === user.username;
        }
        if (collection.permission === 'PUBLIC') {
            return user.role === 'Admin' || user.role === 'SuperAdmin';
        }
        if (collection.permission === 'DEPARTMENT') {
            return collection.createdBy === user.username || user.role === 'Admin' || user.role === 'SuperAdmin';
        }
        return false;
    }
    async getAllCollections() {
        return this.model.find({}).exec();
    }
    async createCollection(name, permission, user, modelId) {
        if (!name || typeof name !== 'string' || !name.trim()) {
            throw new Error('Collection name cannot be empty');
        }
        const trimmed = name.trim();
        if (trimmed.length < 3)
            throw new Error('Collection name must be at least 3 characters long');
        if (trimmed.length > 100)
            throw new Error('Collection name cannot exceed 100 characters');
        if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed))
            throw new Error('Collection name can only contain letters, numbers, spaces, hyphens, and underscores');
        const existing = await this.model.findOne({ name: { $regex: `^${trimmed}$`, $options: 'i' } }).exec();
        if (existing)
            throw new Error('Collection name already exists');
        const doc = {
            name: trimmed,
            permission,
            createdBy: user.username,
            department: user.department,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        if (modelId)
            doc.modelId = modelId;
        const collection = new this.model(doc);
        return await collection.save();
    }
    async updateCollection(collectionId, updates, userId) {
        try {
            if (userId) {
                const existingCollection = await this.model.findById(collectionId);
                if (!existingCollection) {
                    return null;
                }
                const userService = require('./userService');
                const user = await userService.userService.get_user_by_id(userId);
                if (!user) {
                    return null;
                }
                const isAdmin = user.role === 'Admin' || user.role === 'SuperAdmin';
                if (existingCollection.permission === 'PRIVATE') {
                    if (existingCollection.createdBy !== user.username && !isAdmin) {
                        return null;
                    }
                }
                else if (existingCollection.permission === 'PUBLIC') {
                    if (!isAdmin) {
                        return null;
                    }
                }
                else if (existingCollection.permission === 'DEPARTMENT') {
                    if (existingCollection.createdBy !== user.username && !isAdmin) {
                        return null;
                    }
                }
            }
            if (updates.name) {
                const name = updates.name.trim();
                if (!name) {
                    return null;
                }
                if (name.length < 3) {
                    return null;
                }
                if (name.length > 100) {
                    return null;
                }
                if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
                    return null;
                }
                const existingCollection = await this.model.findOne({ name: { $regex: `^${name}$`, $options: 'i' }, _id: { $ne: collectionId } }).exec();
                if (existingCollection) {
                    return null;
                }
            }
            updates.updatedAt = new Date();
            return await this.model.findByIdAndUpdate(collectionId, updates, { new: true }).exec();
        }
        catch (error) {
            return null;
        }
    }
    async deleteCollection(collectionId, userId) {
        try {
            if (userId) {
                const existingCollection = await this.model.findById(collectionId);
                if (!existingCollection) {
                    return false;
                }
                const userService = require('./userService');
                const user = await userService.userService.get_user_by_id(userId);
                if (!user) {
                    return false;
                }
                const isAdmin = user.role === 'Admin' || user.role === 'SuperAdmin';
                if (existingCollection.permission === 'PRIVATE') {
                    if (existingCollection.createdBy !== user.username && !isAdmin) {
                        return false;
                    }
                }
                else if (existingCollection.permission === 'PUBLIC') {
                    if (!isAdmin) {
                        return false;
                    }
                }
                else if (existingCollection.permission === 'DEPARTMENT') {
                    if (existingCollection.createdBy !== user.username && !isAdmin) {
                        return false;
                    }
                }
            }
            await this.model.findByIdAndDelete(collectionId).exec();
            return true;
        }
        catch (error) {
            return false;
        }
    }
    async findByName(name) {
        try {
            const collection = await this.model.findOne({ name }).exec();
            if (!collection) {
                return null;
            }
            return collection;
        }
        catch (error) {
            return null;
        }
    }
    async getCollectionsByPermission(permission) {
        try {
            const collections = await this.model.find({ permission }).exec();
            return collections;
        }
        catch (error) {
            return [];
        }
    }
    async getCollectionsByDepartment(department) {
        try {
            const collections = await this.model.find({ department }).exec();
            return collections;
        }
        catch (error) {
            return [];
        }
    }
    async searchCollections(query, userId, department) {
        try {
            const searchRegex = new RegExp(query, 'i');
            let filter = {
                name: searchRegex
            };
            if (userId) {
                filter = {
                    $and: [
                        { name: searchRegex },
                        {
                            $or: [
                                { createdBy: userId },
                                { permission: collection_1.CollectionPermission.PUBLIC },
                                {
                                    permission: collection_1.CollectionPermission.DEPARTMENT,
                                    department: department
                                }
                            ]
                        }
                    ]
                };
            }
            const collections = await this.model.find(filter).exec();
            return collections;
        }
        catch (error) {
            return [];
        }
    }
    async getCollectionsByUser(userId) {
        try {
            const collections = await this.model.find({ createdBy: userId }).exec();
            return collections;
        }
        catch (error) {
            return [];
        }
    }
    async getCollectionStats() {
        try {
            const [totalCollections, publicCount, privateCount, departmentCount] = await Promise.all([
                this.model.countDocuments(),
                this.model.countDocuments({ permission: collection_1.CollectionPermission.PUBLIC }),
                this.model.countDocuments({ permission: collection_1.CollectionPermission.PRIVATE }),
                this.model.countDocuments({ permission: collection_1.CollectionPermission.DEPARTMENT })
            ]);
            const stats = {
                total: totalCollections,
                byPermission: {
                    public: publicCount,
                    private: privateCount,
                    department: departmentCount
                }
            };
            return stats;
        }
        catch (error) {
            return null;
        }
    }
    async hasAccess(collectionId, userId, department) {
        try {
            const collection = await this.model.findById(collectionId).exec();
            if (!collection) {
                return false;
            }
            let user = null;
            let isAdmin = false;
            let username = null;
            if (userId) {
                const userService = require('./userService');
                user = await userService.userService.get_user_by_id(userId);
                if (user) {
                    isAdmin = user.role === 'Admin' || user.role === 'SuperAdmin';
                    username = user.username;
                }
            }
            if (collection.permission === 'PUBLIC') {
                return true;
            }
            if (isAdmin) {
                return true;
            }
            if (username && collection.createdBy === username) {
                return true;
            }
            if (collection.permission === 'DEPARTMENT' && user && user.department && collection.department === user.department) {
                return true;
            }
            if (collection.permission === 'PRIVATE') {
                return false;
            }
            return false;
        }
        catch (error) {
            return false;
        }
    }
}
exports.CollectionService = CollectionService;
exports.collectionService = new CollectionService();
//# sourceMappingURL=collectionService.js.map