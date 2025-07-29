import mongoose, { Document } from 'mongoose';
export interface IDepartment extends Document {
    name: string;
    code: string;
    description?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Department: mongoose.Model<IDepartment, {}, {}, {}, mongoose.Document<unknown, {}, IDepartment, {}> & IDepartment & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=department.d.ts.map