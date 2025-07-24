import { ICollection, CollectionPermission } from '../models/collection';
export declare class CollectionService {
    model: import("mongoose").Model<ICollection, {}, {}, {}, import("mongoose").Document<unknown, {}, ICollection, {}> & ICollection & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }, any>;
    constructor();
    getUserCollections(user: any): Promise<(import("mongoose").Document<unknown, {}, ICollection, {}> & ICollection & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
    getCollectionById(collectionId: string): Promise<(import("mongoose").Document<unknown, {}, ICollection, {}> & ICollection & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null>;
    canUserModifyCollection(user: any, collection: any): boolean;
    getAllCollections(): Promise<ICollection[]>;
    createCollection(name: string, permission: string, user: any, modelId?: string): Promise<import("mongoose").Document<unknown, {}, ICollection, {}> & ICollection & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateCollection(collectionId: string, updates: Partial<ICollection>, userId?: string): Promise<ICollection | null>;
    deleteCollection(collectionId: string, userId?: string): Promise<boolean>;
    findByName(name: string): Promise<ICollection | null>;
    getCollectionsByPermission(permission: CollectionPermission): Promise<ICollection[]>;
    getCollectionsByDepartment(department: string): Promise<ICollection[]>;
    searchCollections(query: string, userId?: string, department?: string): Promise<ICollection[]>;
    getCollectionsByUser(userId: string): Promise<ICollection[]>;
    getCollectionStats(): Promise<any>;
    hasAccess(collectionId: string, userId?: string, department?: string): Promise<boolean>;
}
export declare const collectionService: CollectionService;
//# sourceMappingURL=collectionService.d.ts.map