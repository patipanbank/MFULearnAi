import { ICollection, CollectionPermission } from '../models/collection';
import { IUser } from '../models/user';
export declare class CollectionService {
    getAllCollections(): Promise<any[]>;
    getCollectionById(collectionId: string): Promise<any | null>;
    createCollection(name: string, permission: CollectionPermission, createdBy: IUser, modelId?: string): Promise<any>;
    updateCollection(collectionId: string, updates: Partial<ICollection>): Promise<any | null>;
    deleteCollection(collectionOrId: any): Promise<boolean>;
    getUserCollections(user: IUser): Promise<any[]>;
    canUserAccessCollection(user: IUser, collection: any): boolean;
    canUserModifyCollection(user: IUser, collection: any): boolean;
}
export declare const collectionService: CollectionService;
//# sourceMappingURL=collectionService.d.ts.map