import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { SystemPromptService } from '../system-prompt/system-prompt.service';
export declare class AdminController {
    private readonly adminService;
    private readonly spService;
    constructor(adminService: AdminService, spService: SystemPromptService);
    all(): Promise<(import("mongoose").FlattenMaps<import("..").UserDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    })[]>;
    get(id: string): Promise<import("mongoose").FlattenMaps<import("..").UserDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    }>;
    create(dto: CreateAdminDto): Promise<import("mongoose").Document<unknown, {}, import("..").UserDocument, {}> & import("..").UserDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    update(id: string, dto: UpdateAdminDto): Promise<import("mongoose").FlattenMaps<import("..").UserDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
    getPrompt(): Promise<(import("mongoose").FlattenMaps<import("../system-prompt/system-prompt.schema").SystemPromptDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    }) | null>;
    updatePrompt(prompt: string): Promise<(import("mongoose").FlattenMaps<import("../system-prompt/system-prompt.schema").SystemPromptDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    }) | null>;
}
