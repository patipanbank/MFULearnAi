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
exports.TrainingService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const document_service_1 = require("../../services/document.service");
const bedrock_service_1 = require("../../infrastructure/bedrock/bedrock.service");
let TrainingService = class TrainingService {
    constructor(queue, documentService, bedrockService) {
        this.queue = queue;
        this.documentService = documentService;
        this.bedrockService = bedrockService;
        this.chunkSize = 1000;
        this.chunkOverlap = 200;
    }
    splitText(text) {
        const chunks = [];
        let start = 0;
        while (start < text.length) {
            const end = Math.min(start + this.chunkSize, text.length);
            chunks.push(text.slice(start, end));
            start += this.chunkSize - this.chunkOverlap;
        }
        return chunks;
    }
    async processBuffer(buffer, filename, chatId) {
        const text = await this.documentService.parseFileContent(buffer, filename);
        if (!text)
            return 0;
        const chunks = this.splitText(text);
        for (const chunk of chunks) {
            await this.queue.add('embed', { text: chunk, chatId, messageId: filename });
        }
        return chunks.length;
    }
    async processRawText(text, chatId) {
        const chunks = this.splitText(text);
        for (const chunk of chunks) {
            await this.queue.add('embed', { text: chunk, chatId, messageId: `text-${Date.now()}` });
        }
        return chunks.length;
    }
    async processUrlContent(text, url) {
        const chunks = this.splitText(text);
        for (const chunk of chunks) {
            await this.queue.add('embed', { text: chunk, chatId: undefined, messageId: url });
        }
        return chunks.length;
    }
};
exports.TrainingService = TrainingService;
exports.TrainingService = TrainingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('BULL_QUEUE')),
    __metadata("design:paramtypes", [bullmq_1.Queue,
        document_service_1.DocumentService,
        bedrock_service_1.BedrockService])
], TrainingService);
//# sourceMappingURL=training.service.js.map