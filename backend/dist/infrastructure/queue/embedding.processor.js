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
exports.EmbeddingProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const bedrock_service_1 = require("../bedrock/bedrock.service");
const chroma_service_1 = require("../../services/chroma.service");
let EmbeddingProcessor = class EmbeddingProcessor extends bullmq_1.WorkerHost {
    constructor(bedrockService, chromaService) {
        super();
        this.bedrockService = bedrockService;
        this.chromaService = chromaService;
    }
    async process(job) {
        const { text, chatId, messageId } = job.data;
        const embedding = await this.bedrockService.embed(text);
        await this.chromaService.addDocuments(`chat:${chatId}`, [
            { id: messageId, text, embedding },
        ]);
    }
};
exports.EmbeddingProcessor = EmbeddingProcessor;
exports.EmbeddingProcessor = EmbeddingProcessor = __decorate([
    (0, bullmq_1.Processor)('default'),
    __metadata("design:paramtypes", [bedrock_service_1.BedrockService,
        chroma_service_1.ChromaService])
], EmbeddingProcessor);
//# sourceMappingURL=embedding.processor.js.map