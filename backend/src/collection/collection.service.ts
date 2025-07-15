import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Collection, CollectionDocument, CollectionPermission } from '../models/collection.model';
import { User, UserRole } from '../models/user.model';
import { ChromaService, ChromaDocument } from '../services/chroma.service';

export interface CreateCollectionDto {
  name: string;
  permission: CollectionPermission;
  modelId?: string;
}

export interface UpdateCollectionDto {
  name?: string;
  permission?: CollectionPermission;
}

@Injectable()
export class CollectionService {
  constructor(
    @InjectModel(Collection.name) private collectionModel: Model<CollectionDocument>,
    private chromaService: ChromaService,
  ) {}

  async getAllCollections(): Promise<Collection[]> {
    try {
      return await this.collectionModel
        .find({ isActive: true })
        .populate('createdBy', 'username email')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      throw new BadRequestException('Failed to get collections');
    }
  }

  async getUserCollections(user: User): Promise<Collection[]> {
    try {
      const filter = {
        $or: [
          { createdBy: (user as any)._id },
          { permission: CollectionPermission.PUBLIC },
          { 
            permission: CollectionPermission.DEPARTMENT,
            'metadata.department': user.department
          }
        ],
        isActive: true
      };

      return await this.collectionModel
        .find(filter)
        .populate('createdBy', 'username email')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      throw new BadRequestException('Failed to get user collections');
    }
  }

  async getPublicCollections(): Promise<Collection[]> {
    try {
      return await this.collectionModel
        .find({ 
          permission: CollectionPermission.PUBLIC,
          isActive: true 
        })
        .populate('createdBy', 'username email')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      return []; // Return empty array on error for public route
    }
  }

  async createCollection(
    name: string,
    permission: CollectionPermission,
    createdBy: User,
    modelId?: string,
  ): Promise<Collection> {
    try {
      // Validate collection name (เหมือน FastAPI)
      if (!name || !name.trim()) {
        throw new BadRequestException('Collection name cannot be empty');
      }
      
      name = name.trim();
      if (name.length < 3) {
        throw new BadRequestException('Collection name must be at least 3 characters long');
      }
      
      if (name.length > 100) {
        throw new BadRequestException('Collection name cannot exceed 100 characters');
      }
      
      // Check for invalid characters (เหมือน FastAPI regex)
      const nameRegex = /^[a-zA-Z0-9\s\-_]+$/;
      if (!nameRegex.test(name)) {
        throw new BadRequestException('Collection name can only contain letters, numbers, spaces, hyphens, and underscores');
      }

      // Check if collection with same name already exists
      const existingCollection = await this.collectionModel.findOne({ name });
      if (existingCollection) {
        throw new BadRequestException(`Collection with name '${name}' already exists`);
      }

      const newCollection = new this.collectionModel({
        name,
        permission,
        createdBy: (createdBy as any)._id,
        modelId,
        metadata: {
          department: createdBy.department,
          createdByUsername: createdBy.username,
        },
      });

      const savedCollection = await newCollection.save();

      // Create corresponding ChromaDB collection
      try {
        await this.chromaService.createCollection(name);
      } catch (error) {
        console.error('Failed to create ChromaDB collection:', error);
        // Don't fail the entire operation if ChromaDB is down
      }

      return savedCollection;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create collection: ${error.message}`);
    }
  }

  async getCollectionById(id: string): Promise<Collection | null> {
    try {
      return await this.collectionModel
        .findById(id)
        .populate('createdBy', 'username email')
        .exec();
    } catch (error) {
      return null;
    }
  }

  async updateCollection(id: string, updates: UpdateCollectionDto): Promise<Collection | null> {
    try {
      const updatedCollection = await this.collectionModel
        .findByIdAndUpdate(
          id,
          { ...updates, updatedAt: new Date() },
          { new: true }
        )
        .populate('createdBy', 'username email')
        .exec();

      return updatedCollection;
    } catch (error) {
      throw new BadRequestException('Failed to update collection');
    }
  }

  async deleteCollection(collection: Collection, user: User): Promise<void> {
    try {
      // Soft delete by setting isActive to false
      await this.collectionModel.findByIdAndUpdate(
        (collection as any)._id,
        { isActive: false, updatedAt: new Date() }
      );

      // Delete from ChromaDB
      try {
        await this.chromaService.deleteCollection(collection.name);
      } catch (error) {
        console.error('Failed to delete ChromaDB collection:', error);
        // Don't fail the entire operation if ChromaDB is down
      }
    } catch (error) {
      throw new BadRequestException('Failed to delete collection');
    }
  }

  canUserAccessCollection(user: User, collection: Collection): boolean {
    // Public collections can be accessed by anyone
    if (collection.permission === CollectionPermission.PUBLIC) {
      return true;
    }

    // Private collections can only be accessed by creator
    if (collection.permission === CollectionPermission.PRIVATE) {
      return collection.metadata?.createdByUsername === user.username;
    }

    // Department collections can be accessed by same department users
    if (collection.permission === CollectionPermission.DEPARTMENT) {
      return (
        collection.metadata?.createdByUsername === user.username ||
        user.department === collection.metadata?.department
      );
    }

    // Admin and Super Admin can access all collections (เหมือน FastAPI)
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Default to no access
    return false;
  }

  canUserModifyCollection(user: User, collection: Collection): boolean {
    // Private collections can only be modified by creator (เหมือน FastAPI)
    if (collection.permission === CollectionPermission.PRIVATE) {
      return collection.metadata?.createdByUsername === user.username;
    }

    // Public collections can only be modified by Admin and Super Admin (เหมือน FastAPI)
    if (collection.permission === CollectionPermission.PUBLIC) {
      return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    }

    // Department collections can only be modified by creator (เหมือน FastAPI)
    if (collection.permission === CollectionPermission.DEPARTMENT) {
      return collection.metadata?.createdByUsername === user.username;
    }

    // Admin and Super Admin can modify all collections (เหมือน FastAPI)
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Default to no access
    return false;
  }

  async getCollectionAnalytics(): Promise<{
    totalCollections: number;
    totalDocuments: number;
    totalSize: number;
  }> {
    try {
      const collections = await this.collectionModel
        .find({ isActive: true })
        .exec();

      const totalCollections = collections.length;
      const totalDocuments = collections.reduce((sum, col) => sum + col.documentCount, 0);
      const totalSize = collections.reduce((sum, col) => sum + col.size, 0);

      return {
        totalCollections,
        totalDocuments,
        totalSize,
      };
    } catch (error) {
      throw new BadRequestException('Failed to get collection analytics');
    }
  }

  async updateCollectionStats(collectionId: string, documentCount: number, size: number): Promise<void> {
    try {
      await this.collectionModel.findByIdAndUpdate(
        collectionId,
        { documentCount, size, updatedAt: new Date() }
      );
    } catch (error) {
      console.error('Failed to update collection stats:', error);
    }
  }

  // Document Management Methods
  async getDocuments(collectionName: string, limit: number = 100, offset: number = 0): Promise<ChromaDocument[]> {
    try {
      return await this.chromaService.getDocuments(collectionName, limit, offset);
    } catch (error) {
      console.error('Failed to get documents from ChromaDB:', error);
      return [];
    }
  }

  async deleteDocuments(collectionName: string, documentIds: string[]): Promise<void> {
    try {
      await this.chromaService.deleteDocuments(collectionName, documentIds);
      
      // Update collection stats
      const collection = await this.collectionModel.findOne({ name: collectionName });
      if (collection) {
        const newCount = Math.max(0, collection.documentCount - documentIds.length);
        await this.updateCollectionStats((collection as any)._id.toString(), newCount, collection.size);
      }
    } catch (error) {
      throw new BadRequestException(`Failed to delete documents: ${error.message}`);
    }
  }

  async addDocuments(collectionName: string, documents: ChromaDocument[]): Promise<void> {
    try {
      await this.chromaService.addDocuments(collectionName, documents);
      
      // Update collection stats
      const collection = await this.collectionModel.findOne({ name: collectionName });
      if (collection) {
        const newCount = collection.documentCount + documents.length;
        const newSize = collection.size + documents.reduce((sum, doc) => sum + doc.content.length, 0);
        await this.updateCollectionStats((collection as any)._id.toString(), newCount, newSize);
      }
    } catch (error) {
      throw new BadRequestException(`Failed to add documents: ${error.message}`);
    }
  }

  async queryDocuments(collectionName: string, queryText: string, nResults: number = 10): Promise<any> {
    try {
      return await this.chromaService.query(collectionName, queryText, nResults);
    } catch (error) {
      throw new BadRequestException(`Failed to query documents: ${error.message}`);
    }
  }
} 