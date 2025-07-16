import { Model } from 'mongoose';
import { Collection } from '../models/collection.model';
import { User } from '../models/user.model';
export declare enum CollectionPermission {
    PUBLIC = "PUBLIC",
    DEPARTMENT = "DEPARTMENT",
    PRIVATE = "PRIVATE"
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
export declare class CollectionService {
    private collectionModel;
    private userModel;
    private readonly logger;
    constructor(collectionModel: Model<Collection>, userModel: Model<User>);
    getAllCollections(): Promise<Collection[]>;
    getCollectionById(collectionId: string): Promise<Collection | null>;
    createCollection(name: string, permission: CollectionPermission, createdBy: User, modelId?: string): Promise<Collection>;
    updateCollection(collectionId: string, updates: UpdateCollectionDto): Promise<Collection | null>;
    deleteCollection(collectionId: string): Promise<boolean>;
    getUserCollections(user: User): Promise<Collection[]>;
    canUserAccessCollection(user: User, collection: Collection): boolean;
    canUserModifyCollection(user: User, collection: Collection): boolean;
    getCollectionsByDepartment(department: string): Promise<Collection[]>;
    getCollectionsByCreator(username: string): Promise<Collection[]>;
}
