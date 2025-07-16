import { Document } from 'mongoose';
export declare enum UserRole {
    ADMIN = "Admin",
    STAFFS = "Staffs",
    STUDENTS = "Students",
    SUPER_ADMIN = "SuperAdmin"
}
export type UserDocument = User & Document;
export declare class User {
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
export declare const UserSchema: import("mongoose").Schema<User, import("mongoose").Model<User, any, any, any, Document<unknown, any, User, any> & User & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, User, Document<unknown, {}, import("mongoose").FlatRecord<User>, {}> & import("mongoose").FlatRecord<User> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
