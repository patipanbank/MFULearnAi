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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemPromptService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let SystemPromptService = class SystemPromptService {
    constructor(model) {
        this.model = model;
    }
    async getSystemPrompt() {
        let prompt = await this.model.findOne().lean();
        if (!prompt) {
            const created = await this.model.create({ prompt: 'You are a helpful assistant.', updatedBy: 'system' });
            prompt = created.toObject();
        }
        return prompt;
    }
    async updateSystemPrompt(prompt, updatedBy) {
        const updated = await this.model.findOneAndUpdate({}, { $set: { prompt, updatedBy, updatedAt: new Date() } }, { new: true, upsert: true, lean: true });
        return updated;
    }
};
exports.SystemPromptService = SystemPromptService;
exports.SystemPromptService = SystemPromptService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('SystemPrompt')),
    __metadata("design:paramtypes", [mongoose_2.Model])
], SystemPromptService);
//# sourceMappingURL=system-prompt.service.js.map