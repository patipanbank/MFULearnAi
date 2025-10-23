import { Document } from 'mongoose';
export declare enum UserRole {
    ADMIN = "Admin",
    STAFFS = "Staffs",
    STUDENTS = "Students",
    SUPER_ADMIN = "SuperAdmin"
}
export interface IUser extends Document {
    nameID: string;
    username: string;
    password?: string;
    email: string;
    firstName?: string;
    lastName?: string;
    department?: string;
    role: UserRole;
    groups: string[];
    tokenQuota?: number;
    dailyTokenLimit?: number;
    created: Date;
    updated: Date;
}
export declare const User: any;
//# sourceMappingURL=user.d.ts.map