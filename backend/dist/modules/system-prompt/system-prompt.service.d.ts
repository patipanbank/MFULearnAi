import { Model } from 'mongoose';
import { SystemPromptDocument } from './system-prompt.schema';
export declare class SystemPromptService {
    private readonly model;
    constructor(model: Model<SystemPromptDocument>);
    getSystemPrompt(): Promise<(import("mongoose").FlattenMaps<SystemPromptDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    }) | null>;
    updateSystemPrompt(prompt: string, updatedBy: string): Promise<(import("mongoose").FlattenMaps<SystemPromptDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    }) | null>;
}
