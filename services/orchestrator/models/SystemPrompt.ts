import mongoose, { Document, Schema } from 'mongoose';

export interface ISystemPrompt extends Document {
    key: string;       // e.g., 'DINDINAI_SYSTEM_PROMPT', 'MFULEARNAI_SYSTEM_PROMPT'
    content: string;   // The markdown prompt
    description?: string;
    updatedBy?: string;
    isActive: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}

const SystemPromptSchema: Schema = new Schema({
    key: { type: String, required: true, unique: true },
    content: { type: String, required: true },
    description: { type: String },
    updatedBy: { type: String },
    isActive: { type: Boolean, default: true },
    version: { type: Number, default: 1 }
}, {
    timestamps: true
});

export default mongoose.model<ISystemPrompt>('SystemPrompt', SystemPromptSchema);
