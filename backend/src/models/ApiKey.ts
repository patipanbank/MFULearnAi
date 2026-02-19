import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IApiKey extends Document {
    user: Types.ObjectId;
    keyHash: string;
    keyPrefix: string;
    name: string;
    scopes: string[];
    lastUsedAt?: Date;
    expiresAt?: Date;
    createdAt: Date;
    revokedAt?: Date;
}

const ApiKeySchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    keyHash: { type: String, required: true, unique: true },
    keyPrefix: { type: String, required: true },
    name: { type: String, required: true },
    scopes: { type: [String], default: [] },
    lastUsedAt: { type: Date },
    expiresAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    revokedAt: { type: Date }
});

// Index for faster lookup by keyHash
ApiKeySchema.index({ keyHash: 1 });
ApiKeySchema.index({ user: 1 });

export default mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
