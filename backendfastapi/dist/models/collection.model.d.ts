import { Document, Types } from 'mongoose';
export type CollectionDocument = Collection & Document;
export declare enum CollectionPermission {
    PUBLIC = "PUBLIC",
    PRIVATE = "PRIVATE",
    DEPARTMENT = "DEPARTMENT"
}
export declare class Collection {
    name: string;
    permission: CollectionPermission;
    createdBy: string;
    department: string;
    modelId?: string;
    documentCount: number;
    size: number;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    metadata?: Record<string, any>;
}
export declare const CollectionSchema: import("mongoose").Schema<Collection, import("mongoose").Model<Collection, any, any, any, Document<unknown, any, Collection, any> & Collection & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Collection, Document<unknown, {}, import("mongoose").FlatRecord<Collection>, {}> & import("mongoose").FlatRecord<Collection> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
