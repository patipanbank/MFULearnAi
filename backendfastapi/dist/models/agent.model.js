"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentTemplateSchema = exports.AgentTemplate = exports.AgentSchema = exports.Agent = exports.AgentExecutionSchema = exports.AgentExecution = exports.TokenUsageSchema = exports.TokenUsage = exports.AgentExecutionStatus = exports.AgentToolSchema = exports.AgentTool = exports.AgentToolType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var AgentToolType;
(function (AgentToolType) {
    AgentToolType["FUNCTION"] = "function";
    AgentToolType["RETRIEVER"] = "retriever";
    AgentToolType["WEB_SEARCH"] = "web_search";
    AgentToolType["CALCULATOR"] = "calculator";
})(AgentToolType || (exports.AgentToolType = AgentToolType = {}));
let AgentTool = class AgentTool {
    id;
    name;
    description;
    type;
    config;
    enabled;
};
exports.AgentTool = AgentTool;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentTool.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentTool.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentTool.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: AgentToolType }),
    __metadata("design:type", String)
], AgentTool.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], AgentTool.prototype, "config", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], AgentTool.prototype, "enabled", void 0);
exports.AgentTool = AgentTool = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: function (doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    })
], AgentTool);
exports.AgentToolSchema = mongoose_1.SchemaFactory.createForClass(AgentTool);
var AgentExecutionStatus;
(function (AgentExecutionStatus) {
    AgentExecutionStatus["IDLE"] = "idle";
    AgentExecutionStatus["THINKING"] = "thinking";
    AgentExecutionStatus["USING_TOOL"] = "using_tool";
    AgentExecutionStatus["RESPONDING"] = "responding";
    AgentExecutionStatus["ERROR"] = "error";
})(AgentExecutionStatus || (exports.AgentExecutionStatus = AgentExecutionStatus = {}));
let TokenUsage = class TokenUsage {
    input;
    output;
};
exports.TokenUsage = TokenUsage;
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], TokenUsage.prototype, "input", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], TokenUsage.prototype, "output", void 0);
exports.TokenUsage = TokenUsage = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: function (doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    })
], TokenUsage);
exports.TokenUsageSchema = mongoose_1.SchemaFactory.createForClass(TokenUsage);
let AgentExecution = class AgentExecution {
    id;
    agentId;
    sessionId;
    status;
    currentTool;
    progress;
    startTime;
    endTime;
    tokenUsage;
};
exports.AgentExecution = AgentExecution;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentExecution.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: mongoose_2.Types.ObjectId, ref: 'Agent' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], AgentExecution.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentExecution.prototype, "sessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: AgentExecutionStatus, default: AgentExecutionStatus.IDLE }),
    __metadata("design:type", String)
], AgentExecution.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentExecution.prototype, "currentTool", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], AgentExecution.prototype, "progress", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: Date.now }),
    __metadata("design:type", Date)
], AgentExecution.prototype, "startTime", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], AgentExecution.prototype, "endTime", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: exports.TokenUsageSchema, default: () => ({ input: 0, output: 0 }) }),
    __metadata("design:type", TokenUsage)
], AgentExecution.prototype, "tokenUsage", void 0);
exports.AgentExecution = AgentExecution = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: function (doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    })
], AgentExecution);
exports.AgentExecutionSchema = mongoose_1.SchemaFactory.createForClass(AgentExecution);
let Agent = class Agent {
    name;
    description;
    systemPrompt;
    modelId;
    collectionNames;
    tools;
    temperature;
    maxTokens;
    isPublic;
    tags;
    createdBy;
    userId;
    createdAt;
    updatedAt;
    usageCount;
    rating;
};
exports.Agent = Agent;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Agent.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Agent.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Agent.prototype, "systemPrompt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Agent.prototype, "modelId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Agent.prototype, "collectionNames", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.AgentToolSchema], default: [] }),
    __metadata("design:type", Array)
], Agent.prototype, "tools", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0.7 }),
    __metadata("design:type", Number)
], Agent.prototype, "temperature", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 4000 }),
    __metadata("design:type", Number)
], Agent.prototype, "maxTokens", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Agent.prototype, "isPublic", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Agent.prototype, "tags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Agent.prototype, "createdBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Agent.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], Agent.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], Agent.prototype, "updatedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Agent.prototype, "usageCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0.0 }),
    __metadata("design:type", Number)
], Agent.prototype, "rating", void 0);
exports.Agent = Agent = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: function (doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    })
], Agent);
exports.AgentSchema = mongoose_1.SchemaFactory.createForClass(Agent);
exports.AgentSchema.index({ name: 1 });
exports.AgentSchema.index({ modelId: 1 });
exports.AgentSchema.index({ createdBy: 1 });
exports.AgentSchema.index({ isPublic: 1 });
exports.AgentSchema.index({ tags: 1 });
exports.AgentSchema.index({ createdAt: -1 });
exports.AgentSchema.index({ usageCount: -1 });
exports.AgentSchema.index({ rating: -1 });
exports.AgentSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});
exports.AgentSchema.pre('findOneAndUpdate', function (next) {
    this.set({ updatedAt: new Date() });
    next();
});
let AgentTemplate = class AgentTemplate {
    name;
    description;
    category;
    icon;
    systemPrompt;
    recommendedTools;
    recommendedCollections;
    tags;
};
exports.AgentTemplate = AgentTemplate;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentTemplate.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentTemplate.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentTemplate.prototype, "category", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentTemplate.prototype, "icon", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentTemplate.prototype, "systemPrompt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], AgentTemplate.prototype, "recommendedTools", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], AgentTemplate.prototype, "recommendedCollections", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], AgentTemplate.prototype, "tags", void 0);
exports.AgentTemplate = AgentTemplate = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: function (doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    })
], AgentTemplate);
exports.AgentTemplateSchema = mongoose_1.SchemaFactory.createForClass(AgentTemplate);
//# sourceMappingURL=agent.model.js.map