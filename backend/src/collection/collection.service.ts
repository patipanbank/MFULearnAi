import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Collection } from '../models/collection.model';
import { User, UserRole } from '../models/user.model';

export enum CollectionPermission {
  PUBLIC = 'PUBLIC',
  DEPARTMENT = 'DEPARTMENT',
  PRIVATE = 'PRIVATE',
}

export interface CreateCollectionDto {
  name: string;
  permission: CollectionPermission;
  modelId?: string;
}

export interface UpdateCollectionDto {
  name?: string;
  permission?: CollectionPermission;
  modelId?: string;
}

@Injectable()
export class CollectionService {
  private readonly logger = new Logger(CollectionService.name);

  constructor(
    @InjectModel(Collection.name) private collectionModel: Model<Collection>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async getAllCollections(): Promise<Collection[]> {
    try {
      const collections = await this.collectionModel.find({}).exec();
      return collections;
    } catch (error) {
      this.logger.error(`Error getting all collections: ${error}`);
      return [];
    }
  }

  async getCollectionById(collectionId: string): Promise<Collection | null> {
    try {
      const collection = await this.collectionModel.findById(collectionId).exec();
      return collection;
    } catch (error) {
      this.logger.error(`Error getting collection by ID: ${error}`);
      return null;
    }
  }

  async createCollection(
    name: string,
    permission: CollectionPermission,
    createdBy: User,
    modelId?: string,
  ): Promise<Collection> {
    try {
      // Validate collection name
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

      // Check for invalid characters (only allow alphanumeric, spaces, hyphens, underscores)
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
        throw new Error('Collection name can only contain letters, numbers, spaces, hyphens, and underscores');
      }

      // Check for duplicate name
      const existingCollection = await this.collectionModel.findOne({ name }).exec();
      if (existingCollection) {
        throw new Error(`Collection with name '${name}' already exists`);
      }

      const collectionData: any = {
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
    } catch (error) {
      this.logger.error(`Error creating collection: ${error}`);
      throw new Error(`Failed to create collection: ${error.message}`);
    }
  }

  async updateCollection(
    collectionId: string,
    updates: UpdateCollectionDto,
  ): Promise<Collection | null> {
    try {
      // Remove undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined),
      );

      if (Object.keys(cleanUpdates).length === 0) {
        return this.getCollectionById(collectionId);
      }

      const collection = await this.collectionModel
        .findByIdAndUpdate(collectionId, cleanUpdates, { new: true })
        .exec();

      return collection;
    } catch (error) {
      this.logger.error(`Error updating collection: ${error}`);
      return null;
    }
  }

  async deleteCollection(collectionId: string): Promise<boolean> {
    try {
      const result = await this.collectionModel.findByIdAndDelete(collectionId).exec();
      return !!result;
    } catch (error) {
      this.logger.error(`Error deleting collection: ${error}`);
      return false;
    }
  }

  async getUserCollections(user: User): Promise<Collection[]> {
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
    } catch (error) {
      this.logger.error(`Error getting user collections: ${error}`);
      return [];
    }
  }

  canUserAccessCollection(user: User, collection: Collection): boolean {
    // Public collections can be accessed by anyone
    if (collection.permission === CollectionPermission.PUBLIC) {
      return true;
    }

    // Private collections can only be accessed by creator
    if (collection.permission === CollectionPermission.PRIVATE) {
      return collection.createdBy === user.username;
    }

    // Department collections can be accessed by same department users
    if (collection.permission === CollectionPermission.DEPARTMENT) {
      return (
        collection.createdBy === user.username ||
        user.department === collection.department
      );
    }

    // Admin and Super Admin can access all collections
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Default to no access
    return false;
  }

  canUserModifyCollection(user: User, collection: Collection): boolean {
    // Private collections can only be modified by creator
    if (collection.permission === CollectionPermission.PRIVATE) {
      return collection.createdBy === user.username;
    }

    // Public collections can only be modified by Admin and Super Admin
    if (collection.permission === CollectionPermission.PUBLIC) {
      return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    }

    // Department collections can only be modified by creator
    if (collection.permission === CollectionPermission.DEPARTMENT) {
      return collection.createdBy === user.username;
    }

    // Admin and Super Admin can modify all collections
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Default to no access
    return false;
  }

  async getCollectionsByDepartment(department: string): Promise<Collection[]> {
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
    } catch (error) {
      this.logger.error(`Error getting collections by department: ${error}`);
      return [];
    }
  }

  async getCollectionsByCreator(username: string): Promise<Collection[]> {
    try {
      const collections = await this.collectionModel
        .find({ createdBy: username })
        .exec();
      return collections;
    } catch (error) {
      this.logger.error(`Error getting collections by creator: ${error}`);
      return [];
    }
  }
} 