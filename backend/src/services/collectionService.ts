import { Collection, ICollection, CollectionPermission } from '../models/collection';
import { BaseService } from './base/BaseService';
import { ServiceResult } from '../types/base';

export class CollectionService extends BaseService<ICollection> {
  constructor() {
    super(Collection);
    console.log('✅ Collection service initialized');
  }

  /**
   * Get all collections with user-specific filtering
   */
  async getAllCollections(userId?: string, department?: string): Promise<ServiceResult<ICollection[]>> {
    try {
      let filter: any = {};

      if (userId) {
        filter = {
          $or: [
            { createdBy: userId },
            { permission: CollectionPermission.PUBLIC },
            { 
              permission: CollectionPermission.DEPARTMENT,
              department: department 
            }
          ]
        };
      }

      return await this.findWithFilter(filter);
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch collections: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Create collection with validation
   */
  async createCollection(collectionData: Partial<ICollection>): Promise<ServiceResult<ICollection>> {
    try {
      // Validation ชื่อ collection ตาม legacy
      if (!collectionData.name || typeof collectionData.name !== 'string' || !collectionData.name.trim()) {
        return {
          success: false,
          error: 'Collection name cannot be empty'
        };
      }
      const name = collectionData.name.trim();
      if (name.length < 3) {
        return {
          success: false,
          error: 'Collection name must be at least 3 characters long'
        };
      }
      if (name.length > 100) {
        return {
          success: false,
          error: 'Collection name cannot exceed 100 characters'
        };
      }
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
        return {
          success: false,
          error: 'Collection name can only contain letters, numbers, spaces, hyphens, and underscores'
        };
      }
      // Check if collection name already exists (case-insensitive)
      const existingCollection = await this.model.findOne({ name: { $regex: `^${name}$`, $options: 'i' } }).exec();
      if (existingCollection) {
        return {
          success: false,
          error: 'Collection name already exists'
        };
      }

      const collection = new Collection({
        ...collectionData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const savedCollection = await collection.save();
      console.log(`✅ Created collection: ${savedCollection.name}`);
      
      return {
        success: true,
        data: savedCollection,
        message: 'Collection created successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create collection: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update collection with ownership check
   */
  async updateCollection(collectionId: string, updates: Partial<ICollection>, userId?: string): Promise<ServiceResult<ICollection | null>> {
    try {
      // Check ownership/role if userId provided
      if (userId) {
        const existingCollection = await this.model.findById(collectionId);
        if (!existingCollection) {
          return {
            success: false,
            error: 'Collection not found'
          };
        }
        // ดึง user object
        const userService = require('./userService');
        const user = await userService.userService.get_user_by_id(userId);
        if (!user) {
          return {
            success: false,
            error: 'User not found'
          };
        }
        const isAdmin = user.role === 'Admin' || user.role === 'SuperAdmin';
        // Logic ตาม legacy
        if (existingCollection.permission === 'PRIVATE') {
          if (existingCollection.createdBy !== user.username && !isAdmin) {
            return {
              success: false,
              error: 'You can only update your own collections'
            };
          }
        } else if (existingCollection.permission === 'PUBLIC') {
          if (!isAdmin) {
            return {
              success: false,
              error: 'Only admin or superadmin can update public collections'
            };
          }
        } else if (existingCollection.permission === 'DEPARTMENT') {
          if (existingCollection.createdBy !== user.username && !isAdmin) {
            return {
              success: false,
              error: 'You can only update your own department collections or be admin/superadmin'
            };
          }
        }
      }
      // Validation ชื่อ collection ตาม legacy
      if (updates.name) {
        const name = updates.name.trim();
        if (!name) {
          return {
            success: false,
            error: 'Collection name cannot be empty'
          };
        }
        if (name.length < 3) {
          return {
            success: false,
            error: 'Collection name must be at least 3 characters long'
          };
        }
        if (name.length > 100) {
          return {
            success: false,
            error: 'Collection name cannot exceed 100 characters'
          };
        }
        if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
          return {
            success: false,
            error: 'Collection name can only contain letters, numbers, spaces, hyphens, and underscores'
          };
        }
        // Check if new name conflicts with existing collection (case-insensitive)
        const existingCollection = await this.model.findOne({ name: { $regex: `^${name}$`, $options: 'i' }, _id: { $ne: collectionId } }).exec();
        if (existingCollection) {
          return {
            success: false,
            error: 'Collection name already exists'
          };
        }
      }

      updates.updatedAt = new Date();
      return await super.update(collectionId, updates);
    } catch (error) {
      return {
        success: false,
        error: `Failed to update collection: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Delete collection with ownership check
   */
  async deleteCollection(collectionId: string, userId?: string): Promise<ServiceResult<boolean>> {
    try {
      // Check ownership/role if userId provided
      if (userId) {
        const existingCollection = await this.model.findById(collectionId);
        if (!existingCollection) {
          return {
            success: false,
            error: 'Collection not found'
          };
        }
        // ดึง user object
        const userService = require('./userService');
        const user = await userService.userService.get_user_by_id(userId);
        if (!user) {
          return {
            success: false,
            error: 'User not found'
          };
        }
        const isAdmin = user.role === 'Admin' || user.role === 'SuperAdmin';
        // Logic ตาม legacy
        if (existingCollection.permission === 'PRIVATE') {
          if (existingCollection.createdBy !== user.username && !isAdmin) {
            return {
              success: false,
              error: 'You can only delete your own collections'
            };
          }
        } else if (existingCollection.permission === 'PUBLIC') {
          if (!isAdmin) {
            return {
              success: false,
              error: 'Only admin or superadmin can delete public collections'
            };
          }
        } else if (existingCollection.permission === 'DEPARTMENT') {
          if (existingCollection.createdBy !== user.username && !isAdmin) {
            return {
              success: false,
              error: 'You can only delete your own department collections or be admin/superadmin'
            };
          }
        }
      }

      return await super.delete(collectionId);
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete collection: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Find collection by name
   */
  async findByName(name: string): Promise<ServiceResult<ICollection | null>> {
    try {
      const collection = await this.model.findOne({ name }).exec();
      
      if (!collection) {
        return {
          success: false,
          error: 'Collection not found'
        };
      }

      return {
        success: true,
        data: collection
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to find collection: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get collections by permission
   */
  async getCollectionsByPermission(permission: CollectionPermission): Promise<ServiceResult<ICollection[]>> {
    try {
      const collections = await this.model.find({ permission }).exec();
      
      return {
        success: true,
        data: collections,
        message: `Found ${collections.length} collections with permission ${permission}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch collections: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get collections by department
   */
  async getCollectionsByDepartment(department: string): Promise<ServiceResult<ICollection[]>> {
    try {
      const collections = await this.model.find({ department }).exec();
      
      return {
        success: true,
        data: collections,
        message: `Found ${collections.length} collections in department ${department}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch collections: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Search collections
   */
  async searchCollections(query: string, userId?: string, department?: string): Promise<ServiceResult<ICollection[]>> {
    try {
      const searchRegex = new RegExp(query, 'i');
      let filter: any = {
        name: searchRegex
      };

      if (userId) {
        filter = {
          $and: [
            { name: searchRegex },
            {
              $or: [
                { createdBy: userId },
                { permission: CollectionPermission.PUBLIC },
                { 
                  permission: CollectionPermission.DEPARTMENT,
                  department: department 
                }
              ]
            }
          ]
        };
      }

      const collections = await this.model.find(filter).exec();
      
      return {
        success: true,
        data: collections,
        message: `Found ${collections.length} collections matching "${query}"`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to search collections: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get collections created by user
   */
  async getCollectionsByUser(userId: string): Promise<ServiceResult<ICollection[]>> {
    try {
      const collections = await this.model.find({ createdBy: userId }).exec();
      
      return {
        success: true,
        data: collections,
        message: `Found ${collections.length} collections created by user`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch user collections: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(): Promise<ServiceResult<any>> {
    try {
      const [totalCollections, publicCount, privateCount, departmentCount] = await Promise.all([
        this.model.countDocuments(),
        this.model.countDocuments({ permission: CollectionPermission.PUBLIC }),
        this.model.countDocuments({ permission: CollectionPermission.PRIVATE }),
        this.model.countDocuments({ permission: CollectionPermission.DEPARTMENT })
      ]);

      const stats = {
        total: totalCollections,
        byPermission: {
          public: publicCount,
          private: privateCount,
          department: departmentCount
        }
      };

      return {
        success: true,
        data: stats,
        message: 'Collection statistics retrieved successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get collection statistics: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check if user has access to collection
   */
  async hasAccess(collectionId: string, userId?: string, department?: string): Promise<ServiceResult<boolean>> {
    try {
      const collection = await this.model.findById(collectionId).exec();
      if (!collection) {
        return {
          success: false,
          error: 'Collection not found'
        };
      }
      // ดึง user object ถ้ามี userId
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
      // Public collections are accessible to everyone
      if (collection.permission === 'PUBLIC') {
        return {
          success: true,
          data: true
        };
      }
      // Admin/SuperAdmin can access all collections
      if (isAdmin) {
        return {
          success: true,
          data: true
        };
      }
      // Creator has access to all their collections
      if (username && collection.createdBy === username) {
        return {
          success: true,
          data: true
        };
      }
      // Department collections are accessible to department members
      if (collection.permission === 'DEPARTMENT' && user && user.department && collection.department === user.department) {
        return {
          success: true,
          data: true
        };
      }
      // Private: only owner or admin/superadmin
      if (collection.permission === 'PRIVATE') {
        return {
          success: true,
          data: false
        };
      }
      return {
        success: true,
        data: false
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to check access: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Export singleton instance
export const collectionService = new CollectionService(); 