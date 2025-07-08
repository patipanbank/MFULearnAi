import { Model } from 'mongoose';
import { UserDocument } from './user.schema';
export declare class UserService {
    private readonly userModel;
    constructor(userModel: Model<UserDocument>);
    findByUsername(username: string): Promise<(import("mongoose").Document<unknown, {}, UserDocument, {}> & UserDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null>;
    createUser(username: string, password: string, roles?: string[], department?: string): Promise<import("mongoose").Document<unknown, {}, UserDocument, {}> & UserDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
}
