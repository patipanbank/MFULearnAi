import mongoose from 'mongoose';
declare class UserService {
    get_user_by_id(user_id: string): Promise<(mongoose.Document<unknown, {}, import("../models/user").IUser, {}> & import("../models/user").IUser & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null>;
    get_all_admins(): Promise<(mongoose.Document<unknown, {}, import("../models/user").IUser, {}> & import("../models/user").IUser & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
    find_admin_by_username(username: string): Promise<(mongoose.Document<unknown, {}, import("../models/user").IUser, {}> & import("../models/user").IUser & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null>;
    verify_admin_password(password: string, hashed_password: string): Promise<boolean>;
    find_or_create_saml_user(profile: any): Promise<mongoose.Document<unknown, {}, import("../models/user").IUser, {}> & import("../models/user").IUser & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
}
export declare const userService: UserService;
export {};
//# sourceMappingURL=userService.d.ts.map