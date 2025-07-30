import mongoose, { Document } from 'mongoose';
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
    created: Date;
    updated: Date;
}
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}> & IUser & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=user.d.ts.map