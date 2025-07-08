import { Model } from 'mongoose';
import { UserDocument } from '../users/user.schema';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
export declare class AdminService {
    private readonly userModel;
    constructor(userModel: Model<UserDocument>);
    getAllAdmins(): Promise<(import("mongoose").FlattenMaps<UserDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    })[]>;
    getAdminById(id: string): Promise<import("mongoose").FlattenMaps<UserDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    }>;
    createAdmin(dto: CreateAdminDto): Promise<import("mongoose").Document<unknown, {}, UserDocument, {}> & UserDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateAdmin(id: string, dto: UpdateAdminDto): Promise<import("mongoose").FlattenMaps<UserDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    }>;
    deleteAdmin(id: string): Promise<import("mongoose").FlattenMaps<UserDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    }>;
}
