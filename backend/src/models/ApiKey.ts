import mongoose, { Schema, Document, Types } from 'mongoose';

export type ApiKeyMode = 'agent' | 'model';

export interface IApiKeyRateLimit {
    requestsPerHour: number;
    requestsPerMinute: number;
    tokensPerDay: number;
    tokensPerMonth: number;
}

export interface IApiKey extends Document {
    user: Types.ObjectId;
    keyHash: string;
    keyPrefix: string;
    name: string;
    description?: string;
    scopes: string[];

    /** Key mode: 'agent' = full AgentWorkflow (tools + KB), 'model' = direct LLM call */
    mode: ApiKeyMode;

    // ── Organization & Project ───────────────────────────────
    /** Organization this key belongs to (for multi-tenant billing). */
    organization?: string;
    /** Project identifier for grouping keys. */
    project?: string;

    // ── Agent Mode Settings ──────────────────────────────────
    /** Departments this key can access KB from. ['*'] = all. Empty = user's own dept only. */
    allowedDepartments: string[];
    /** Specific Knowledge IDs this key can access (OR logic with departments). Empty = none extra. */
    allowedKnowledgeIds: string[];
    /** Tool names this key can use. ['*'] = all allowed for role. Empty = no tools. */
    allowedTools: string[];

    // ── Model Mode Settings ──────────────────────────────────
    /** Primary Bedrock model ID for direct mode. Only used when mode='model'. */
    modelId?: string;
    /** Additional models this key can access. Empty = only modelId. ['*'] = all available. */
    allowedModels: string[];
    /** Fallback model if primary fails. */
    fallbackModelId?: string;

    // ── Rate Limits & Quotas (per-key) ───────────────────────
    rateLimit: IApiKeyRateLimit;
    /** Monthly budget in weighted token units. 0 = unlimited. */
    monthlyBudget: number;
    /** Custom daily token limit. 0 = use global default. */
    dailyTokenLimit: number;

    // ── IP Allowlisting ──────────────────────────────────────
    /** Allowed IP addresses/CIDRs. Empty = allow all. */
    allowedIPs: string[];

    // ── Key Rotation ─────────────────────────────────────────
    /** Previous key hashes for grace period during rotation. */
    previousKeyHashes: Array<{ hash: string; rotatedAt: Date; expiresAt: Date }>;

    // ── Metadata ─────────────────────────────────────────────
    lastUsedAt?: Date;
    lastUsedIP?: string;
    expiresAt?: Date;
    createdAt: Date;
    revokedAt?: Date;
    /** Total requests made with this key (counter). */
    totalRequests: number;
    /** Total tokens consumed (counter). */
    totalTokens: number;
    /** Tags for organizing keys. */
    tags: string[];
}

const ApiKeySchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    keyHash: { type: String, required: true, unique: true },
    keyPrefix: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    scopes: { type: [String], default: [] },

    mode: { type: String, enum: ['agent', 'model'], default: 'agent' },

    // Organization & Project
    organization: { type: String, default: '' },
    project: { type: String, default: '' },

    // Agent mode
    allowedDepartments: { type: [String], default: [] },
    allowedKnowledgeIds: { type: [String], default: [] },
    allowedTools: { type: [String], default: ['*'] },

    // Model mode
    modelId: { type: String },
    allowedModels: { type: [String], default: [] },
    fallbackModelId: { type: String },

    // Rate limits (per-key)
    rateLimit: {
        requestsPerHour: { type: Number, default: 1000 },
        requestsPerMinute: { type: Number, default: 60 },
        tokensPerDay: { type: Number, default: 0 },    // 0 = use global
        tokensPerMonth: { type: Number, default: 0 },   // 0 = unlimited
    },
    monthlyBudget: { type: Number, default: 0 },
    dailyTokenLimit: { type: Number, default: 0 },

    // IP allowlisting
    allowedIPs: { type: [String], default: [] },

    // Key rotation
    previousKeyHashes: [{
        hash: { type: String },
        rotatedAt: { type: Date },
        expiresAt: { type: Date },
    }],

    // Metadata
    lastUsedAt: { type: Date },
    lastUsedIP: { type: String },
    expiresAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    revokedAt: { type: Date },
    totalRequests: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
});

// Indexes for faster lookup
ApiKeySchema.index({ keyHash: 1 });
ApiKeySchema.index({ user: 1 });
ApiKeySchema.index({ organization: 1 });
ApiKeySchema.index({ project: 1 });
ApiKeySchema.index({ 'previousKeyHashes.hash': 1 });
ApiKeySchema.index({ tags: 1 });

export default mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
