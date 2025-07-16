import { Document } from 'mongoose';
export type DepartmentDocument = Department & Document;
export declare class Department {
    name: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const DepartmentSchema: import("mongoose").Schema<Department, import("mongoose").Model<Department, any, any, any, Document<unknown, any, Department, any> & Department & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Department, Document<unknown, {}, import("mongoose").FlatRecord<Department>, {}> & import("mongoose").FlatRecord<Department> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
