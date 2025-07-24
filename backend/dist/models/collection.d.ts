import mongoose, { Document } from 'mongoose';
export declare enum CollectionPermission {
    PUBLIC = "PUBLIC",
    PRIVATE = "PRIVATE",
    DEPARTMENT = "DEPARTMENT"
}
export interface ICollection extends Document {
    name: string;
    permission: CollectionPermission;
    createdBy: string;
    department?: string;
    createdAt: Date;
    updatedAt: Date;
    modelId?: string;
}
export declare const Collection: mongoose.Model<ICollection, {}, {}, {}, mongoose.Document<unknown, {}, ICollection, {}> & ICollection & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=collection.d.ts.map