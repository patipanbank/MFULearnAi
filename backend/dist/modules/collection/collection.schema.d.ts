import { Schema, Document } from 'mongoose';
import { CollectionPermission } from './collection-permission.enum';
export interface CollectionDocument extends Document {
    name: string;
    permission: CollectionPermission;
    createdBy: string;
    department?: string;
    modelId?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const CollectionSchema: Schema<CollectionDocument, import("mongoose").Model<CollectionDocument, any, any, any, Document<unknown, any, CollectionDocument, any> & CollectionDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, CollectionDocument, Document<unknown, {}, import("mongoose").FlatRecord<CollectionDocument>, {}> & import("mongoose").FlatRecord<CollectionDocument> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
