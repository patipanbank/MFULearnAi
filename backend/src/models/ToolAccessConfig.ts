import mongoose, { Schema, Document } from 'mongoose';

/**
 * ToolAccessConfig — Persists role-based access overrides for agent tools.
 *
 * Design: "Code-First, DB-Override"
 * - Every AgentTool has hardcoded `allowedRoles` in its class definition.
 * - If a ToolAccessConfig document exists for a tool, the DB roles take precedence.
 * - If no document exists, the tool's coded defaults are used.
 * - New tools auto-appear in the admin UI with their defaults — no migration needed.
 */

export interface ToolAccessConfigDocument extends Document {
    toolName: string;
    allowedRoles: string[];
    /** Human-readable description (auto-populated from tool, editable by admin). */
    description: string;
    /** Whether this tool is entirely disabled regardless of role. */
    isDisabled: boolean;
    /** Source of the tool: 'builtin' | 'mcp'. For display purposes only. */
    source: 'builtin' | 'mcp';
    updatedBy: string;
    updatedAt: Date;
    createdAt: Date;
}

const ToolAccessConfigSchema: Schema = new Schema({
    toolName: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    allowedRoles: {
        type: [String],
        required: true,
        default: ['*']
    },
    description: {
        type: String,
        default: ''
    },
    isDisabled: {
        type: Boolean,
        default: false
    },
    source: {
        type: String,
        enum: ['builtin', 'mcp'],
        default: 'builtin'
    },
    updatedBy: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

export default mongoose.model<ToolAccessConfigDocument>('ToolAccessConfig', ToolAccessConfigSchema);
