import mongoose, { Schema, Document } from 'mongoose';

export type PromptType = 'core' | 'scenario';

export interface IPromptVersion {
    version: number;
    content: string;
    variables: string[];
    changelog: string;
    createdBy: string; // User ID
    createdAt: Date;
    modelConfig?: {
        modelId: string;
        temperature: number;
    };
}

export interface IPrompt extends Document {
    key: string;
    type: PromptType;
    ownerId?: string; // Null/undefined for system, UserID for personal
    name: string;
    description: string;
    tags: string[];
    isPublic: boolean;
    isActive: boolean; // For 'core' type, this marks the active one

    config: {
        modelId?: string;
        temperature?: number;
    };

    versions: IPromptVersion[];
    activeVersion: number; // e.g., 1, 2, 3

    createdAt: Date;
    updatedAt: Date;
}

const PromptVersionSchema = new Schema({
    version: { type: Number, required: true },
    content: { type: String, required: true },
    variables: [{ type: String }],
    changelog: { type: String },
    createdBy: { type: String },
    createdAt: { type: Date, default: Date.now },
    modelConfig: {
        modelId: String,
        temperature: Number
    }
});

const PromptSchema = new Schema({
    key: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['core', 'scenario'], required: true, index: true },
    ownerId: { type: String, index: true }, // Index for fast lookup of user's prompts
    name: { type: String, required: true },
    description: { type: String },
    tags: [{ type: String }],
    isPublic: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false }, // Only useful for Core prompts

    config: {
        modelId: String,
        temperature: Number
    },

    versions: [PromptVersionSchema],
    activeVersion: { type: Number, default: 1 },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Compound index to help searching "My prompts OR Public prompts"
PromptSchema.index({ ownerId: 1, isPublic: 1 });
PromptSchema.index({ type: 1, isActive: 1 }); // Fast find active core prompt

export default mongoose.model<IPrompt>('Prompt', PromptSchema);
