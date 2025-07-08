import { Schema, Document } from 'mongoose';
export interface DepartmentDocument extends Document {
    name: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const DepartmentSchema: Schema<DepartmentDocument, import("mongoose").Model<DepartmentDocument, any, any, any, Document<unknown, any, DepartmentDocument, any> & DepartmentDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, DepartmentDocument, Document<unknown, {}, import("mongoose").FlatRecord<DepartmentDocument>, {}> & import("mongoose").FlatRecord<DepartmentDocument> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
