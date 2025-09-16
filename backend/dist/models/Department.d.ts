import mongoose, { Document } from 'mongoose';
export interface IDepartment extends Document {
    name: string;
    displayName: string;
    description?: string;
    userCount: number;
    isActive: boolean;
    parentDepartment?: string;
    level: number;
    createdBy?: string;
    created: Date;
    updated: Date;
}
interface IDepartmentModel extends mongoose.Model<IDepartment> {
    findOrCreate(departmentName: string, displayName?: string): Promise<IDepartment | null>;
    incrementUserCount(departmentName: string): Promise<void>;
    decrementUserCount(departmentName: string): Promise<void>;
    recalculateUserCounts(): Promise<boolean>;
}
export declare const Department: IDepartmentModel;
export {};
//# sourceMappingURL=Department.d.ts.map