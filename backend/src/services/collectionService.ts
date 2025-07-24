import { Collection, ICollection, CollectionPermission } from '../models/collection';

export class CollectionService {
  public model = Collection;
  constructor() {
    console.log('✅ Collection service initialized');
  }

  // สำหรับ route: getUserCollections(user)
  async getUserCollections(user: any) {
    // PUBLIC, DEPARTMENT (same), PRIVATE (owner)
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

  // สำหรับ route: getCollectionById
  async getCollectionById(collectionId: string) {
    return this.model.findById(collectionId).exec();
  }

  // สำหรับ route: canUserModifyCollection(user, collection)
  canUserModifyCollection(user: any, collection: any) {
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

  /**
   * Get all collections with user-specific filtering
   */
  async getAllCollections(): Promise<ICollection[]> {
    return this.model.find({}).exec();
  }

  /**
   * Create collection with validation
   */
  async createCollection(name: string, permission: string, user: any, modelId?: string) {
    // Validation ชื่อ collection ตาม legacy
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Collection name cannot be empty');
    }
    const trimmed = name.trim();
    if (trimmed.length < 3) throw new Error('Collection name must be at least 3 characters long');
    if (trimmed.length > 100) throw new Error('Collection name cannot exceed 100 characters');
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) throw new Error('Collection name can only contain letters, numbers, spaces, hyphens, and underscores');
    const existing = await this.model.findOne({ name: { $regex: `^${trimmed}$`, $options: 'i' } }).exec();
    if (existing) throw new Error('Collection name already exists');
    const doc: any = {
      name: trimmed,
      permission,
      createdBy: user.username,
      department: user.department,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    if (modelId) doc.modelId = modelId;
    const collection = new this.model(doc);
    return await collection.save();
  }

  /**
   * Update collection with ownership check
   */
  async updateCollection(collectionId: string, updates: Partial<ICollection>, userId?: string): Promise<ICollection | null> {
    try {
      // Check ownership/role if userId provided
      if (userId) {
        const existingCollection = await this.model.findById(collectionId);
        if (!existingCollection) {
          return null;
        }
        // ดึง user object
        const userService = require('./userService');
        const user = await userService.userService.get_user_by_id(userId);
        if (!user) {
          return null;
        }
        const isAdmin = user.role === 'Admin' || user.role === 'SuperAdmin';
        // Logic ตาม legacy
        if (existingCollection.permission === 'PRIVATE') {
          if (existingCollection.createdBy !== user.username && !isAdmin) {
            return null;
          }
        } else if (existingCollection.permission === 'PUBLIC') {
          if (!isAdmin) {
            return null;
          }
        } else if (existingCollection.permission === 'DEPARTMENT') {
          if (existingCollection.createdBy !== user.username && !isAdmin) {
            return null;
          }
        }
      }
      // Validation ชื่อ collection ตาม legacy
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
        // Check if new name conflicts with existing collection (case-insensitive)
        const existingCollection = await this.model.findOne({ name: { $regex: `^${name}$`, $options: 'i' }, _id: { $ne: collectionId } }).exec();
        if (existingCollection) {
          return null;
        }
      }

      updates.updatedAt = new Date();
      return await this.model.findByIdAndUpdate(collectionId, updates, { new: true }).exec();
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete collection with ownership check
   */
  async deleteCollection(collectionId: string, userId?: string): Promise<boolean> {
    try {
      // Check ownership/role if userId provided
      if (userId) {
        const existingCollection = await this.model.findById(collectionId);
        if (!existingCollection) {
          return false;
        }
        // ดึง user object
        const userService = require('./userService');
        const user = await userService.userService.get_user_by_id(userId);
        if (!user) {
          return false;
        }
        const isAdmin = user.role === 'Admin' || user.role === 'SuperAdmin';
        // Logic ตาม legacy
        if (existingCollection.permission === 'PRIVATE') {
          if (existingCollection.createdBy !== user.username && !isAdmin) {
            return false;
          }
        } else if (existingCollection.permission === 'PUBLIC') {
          if (!isAdmin) {
            return false;
          }
        } else if (existingCollection.permission === 'DEPARTMENT') {
          if (existingCollection.createdBy !== user.username && !isAdmin) {
            return false;
          }
        }
      }

      await this.model.findByIdAndDelete(collectionId).exec();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Find collection by name
   */
  async findByName(name: string): Promise<ICollection | null> {
    try {
      const collection = await this.model.findOne({ name }).exec();
      
      if (!collection) {
        return null;
      }

      return collection;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get collections by permission
   */
  async getCollectionsByPermission(permission: CollectionPermission): Promise<ICollection[]> {
    try {
      const collections = await this.model.find({ permission }).exec();
      
      return collections;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get collections by department
   */
  async getCollectionsByDepartment(department: string): Promise<ICollection[]> {
    try {
      const collections = await this.model.find({ department }).exec();
      
      return collections;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search collections
   */
  async searchCollections(query: string, userId?: string, department?: string): Promise<ICollection[]> {
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
      
      return collections;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get collections created by user
   */
  async getCollectionsByUser(userId: string): Promise<ICollection[]> {
    try {
      const collections = await this.model.find({ createdBy: userId }).exec();
      
      return collections;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(): Promise<any> {
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

      return stats;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if user has access to collection
   */
  async hasAccess(collectionId: string, userId?: string, department?: string): Promise<boolean> {
    try {
      const collection = await this.model.findById(collectionId).exec();
      if (!collection) {
        return false;
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
        return true;
      }
      // Admin/SuperAdmin can access all collections
      if (isAdmin) {
        return true;
      }
      // Creator has access to all their collections
      if (username && collection.createdBy === username) {
        return true;
      }
      // Department collections are accessible to department members
      if (collection.permission === 'DEPARTMENT' && user && user.department && collection.department === user.department) {
        return true;
      }
      // Private: only owner or admin/superadmin
      if (collection.permission === 'PRIVATE') {
        return false;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const collectionService = new CollectionService(); 