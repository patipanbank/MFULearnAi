"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentExecutionModel = exports.AgentTemplateModel = exports.AgentModel = exports.AgentExecutionStatus = exports.AgentToolType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var AgentToolType;
(function (AgentToolType) {
    AgentToolType["FUNCTION"] = "function";
    AgentToolType["RETRIEVER"] = "retriever";
    AgentToolType["WEB_SEARCH"] = "web_search";
    AgentToolType["CALCULATOR"] = "calculator";
    AgentToolType["CURRENT_DATE"] = "current_date";
    AgentToolType["MEMORY_SEARCH"] = "memory_search";
    AgentToolType["MEMORY_EMBED"] = "memory_embed";
})(AgentToolType || (exports.AgentToolType = AgentToolType = {}));
var AgentExecutionStatus;
(function (AgentExecutionStatus) {
    AgentExecutionStatus["IDLE"] = "idle";
    AgentExecutionStatus["THINKING"] = "thinking";
    AgentExecutionStatus["USING_TOOL"] = "using_tool";
    AgentExecutionStatus["RESPONDING"] = "responding";
    AgentExecutionStatus["ERROR"] = "error";
})(AgentExecutionStatus || (exports.AgentExecutionStatus = AgentExecutionStatus = {}));
const AgentToolSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    type: {
        type: String,
        enum: Object.values(AgentToolType),
        required: true
    },
    config: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    enabled: { type: Boolean, default: true }
});
const TokenUsageSchema = new mongoose_1.Schema({
    input: { type: Number, default: 0 },
    output: { type: Number, default: 0 }
});
const AgentExecutionSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    agentId: { type: String, required: true },
    sessionId: { type: String, required: true },
    status: {
        type: String,
        enum: Object.values(AgentExecutionStatus),
        default: AgentExecutionStatus.IDLE
    },
    currentTool: String,
    progress: { type: Number, default: 0 },
    startTime: { type: Date, default: Date.now },
    endTime: Date,
    tokenUsage: { type: TokenUsageSchema, default: () => ({ input: 0, output: 0 }) }
});
const AgentSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: [true, 'Agent name is required'],
        trim: true,
        maxlength: [100, 'Agent name cannot exceed 100 characters'],
        default: ''
    },
    description: {
        type: String,
        required: [true, 'Agent description is required'],
        trim: true,
        maxlength: [1000, 'Agent description cannot exceed 1000 characters'],
        default: ''
    },
    systemPrompt: {
        type: String,
        required: [true, 'System prompt is required'],
        trim: true,
        maxlength: [10000, 'System prompt cannot exceed 10000 characters'],
        default: ''
    },
    modelId: {
        type: String,
        required: [true, 'Model ID is required'],
        trim: true,
        default: ''
    },
    collectionNames: {
        type: [String],
        default: [],
        validate: {
            validator: function (v) {
                return Array.isArray(v) && v.every(item => typeof item === 'string');
            },
            message: 'Collection names must be an array of strings'
        }
    },
    tools: {
        type: [AgentToolSchema],
        default: [],
        validate: {
            validator: function (v) {
                return Array.isArray(v);
            },
            message: 'Tools must be an array'
        }
    },
    temperature: {
        type: Number,
        default: 0.7,
        min: [0, 'Temperature must be at least 0'],
        max: [2, 'Temperature cannot exceed 2']
    },
    maxTokens: {
        type: Number,
        default: 4000,
        min: [1, 'Max tokens must be at least 1'],
        max: [32000, 'Max tokens cannot exceed 32000']
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    tags: {
        type: [String],
        default: [],
        validate: {
            validator: function (v) {
                return Array.isArray(v) && v.every(item => typeof item === 'string' && item.length <= 50);
            },
            message: 'Tags must be an array of strings, each no longer than 50 characters'
        }
    },
    createdBy: {
        type: String,
        required: [true, 'Created by field is required'],
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    usageCount: {
        type: Number,
        default: 0,
        min: [0, 'Usage count cannot be negative']
    },
    rating: {
        type: Number,
        default: 0.0,
        min: [0, 'Rating cannot be negative'],
        max: [5, 'Rating cannot exceed 5']
    }
});
const AgentTemplateSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    icon: { type: String, required: true },
    systemPrompt: { type: String, required: true },
    recommendedTools: { type: [String], default: [] },
    recommendedCollections: { type: [String], default: [] },
    tags: { type: [String], default: [] }
});
AgentSchema.index({ createdBy: 1, isPublic: 1 });
AgentSchema.index({ isPublic: 1, usageCount: -1 });
AgentSchema.index({ tags: 1 });
AgentTemplateSchema.index({ category: 1 });
AgentTemplateSchema.index({ tags: 1 });
AgentSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});
exports.AgentModel = mongoose_1.default.model('Agent', AgentSchema);
exports.AgentTemplateModel = mongoose_1.default.model('AgentTemplate', AgentTemplateSchema);
exports.AgentExecutionModel = mongoose_1.default.model('AgentExecution', AgentExecutionSchema);
//# sourceMappingURL=agent.js.map