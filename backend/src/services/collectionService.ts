import { Collection, ICollection, CollectionPermission } from '../models/collection';
import { IUser, UserRole } from '../models/user';
import mongoose from 'mongoose';

function mapId(doc: any): any {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.id = obj._id?.toString();
  delete obj._id;
  return obj;
}

export class CollectionService {
  async getAllCollections(): Promise<any[]> {
    try {
      const docs = await Collection.find({}).exec();
      return docs.map(mapId);
    } catch (e) {
      return [];
    }
  }

  async getCollectionById(collectionId: string): Promise<any | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(collectionId)) return null;
      const doc = await Collection.findById(collectionId).exec();
      return mapId(doc);
    } catch (e) {
      return null;
    }
  }

  async createCollection(name: string, permission: CollectionPermission, createdBy: IUser, modelId?: string): Promise<any> {
    try {
      if (!name || !name.trim()) throw new Error('Collection name cannot be empty');
      name = name.trim();
      if (name.length < 3) throw new Error('Collection name must be at least 3 characters long');
      if (name.length > 100) throw new Error('Collection name cannot exceed 100 characters');
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) throw new Error('Collection name can only contain letters, numbers, spaces, hyphens, and underscores');
      const exists = await Collection.findOne({ name });
      if (exists) throw new Error(`Collection with name '${name}' already exists`);
      const doc: Partial<ICollection> = {
        name,
        permission,
        createdBy: createdBy.username,
        department: createdBy.department,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      if (modelId) doc.modelId = modelId;
      const collection = new Collection(doc);
      await collection.save();
      return mapId(collection);
    } catch (e: any) {
      throw new Error(e.message || 'Failed to create collection');
    }
  }

  async updateCollection(collectionId: string, updates: Partial<ICollection>): Promise<any | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(collectionId)) return null;
      // Remove undefined/null
      const cleanUpdates: Record<string, any> = {};
      for (const k in updates) {
        if ((updates as any)[k] !== undefined && (updates as any)[k] !== null) cleanUpdates[k] = (updates as any)[k];
      }
      cleanUpdates.updatedAt = new Date();
      if (Object.keys(cleanUpdates).length === 1 && cleanUpdates.updatedAt) {
        return await this.getCollectionById(collectionId);
      }
      const updated = await Collection.findByIdAndUpdate(collectionId, { $set: cleanUpdates }, { new: true }).exec();
      return mapId(updated);
    } catch (e) {
      return null;
    }
  }

  async deleteCollection(collectionOrId: any): Promise<boolean> {
    try {
      let id = typeof collectionOrId === 'string' ? collectionOrId : collectionOrId?.id || collectionOrId?._id;
      if (!mongoose.Types.ObjectId.isValid(id)) return false;
      const result = await Collection.deleteOne({ _id: id }).exec();
      return result.deletedCount === 1;
    } catch (e) {
      return false;
    }
  }

  async getUserCollections(user: IUser): Promise<any[]> {
    try {
      const docs = await Collection.find({
        $or: [
          { permission: CollectionPermission.PUBLIC },
          { permission: CollectionPermission.DEPARTMENT, department: user.department },
          { permission: CollectionPermission.PRIVATE, createdBy: user.username },
        ],
      }).exec();
      return docs.map(mapId);
    } catch (e) {
      return [];
    }
  }

  canUserAccessCollection(user: IUser, collection: any): boolean {
    if (collection.permission === CollectionPermission.PUBLIC) return true;
    if (collection.permission === CollectionPermission.PRIVATE) return collection.createdBy === user.username;
    if (collection.permission === CollectionPermission.DEPARTMENT) {
      return collection.createdBy === user.username || user.department === collection.department;
    }
    if ([UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)) return true;
    return false;
  }

  canUserModifyCollection(user: IUser, collection: any): boolean {
    if (collection.permission === CollectionPermission.PRIVATE) return collection.createdBy === user.username;
    if (collection.permission === CollectionPermission.PUBLIC) return [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role);
    if (collection.permission === CollectionPermission.DEPARTMENT) return collection.createdBy === user.username;
    if ([UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)) return true;
    return false;
  }
}

export const collectionService = new CollectionService(); 