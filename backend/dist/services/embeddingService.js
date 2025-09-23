"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.embeddingService = exports.EmbeddingService = void 0;
const realEmbeddingService_1 = require("../core/realEmbeddingService");
class EmbeddingService {
    async getTextEmbeddings(input, model = 'amazon.titan-embed-text-v1') {
        return realEmbeddingService_1.realEmbeddingService.embedBatch(input, { model });
    }
    async embed(text, model = 'amazon.titan-embed-text-v1') {
        return realEmbeddingService_1.realEmbeddingService.embed(text, { model });
    }
    async embedBatch(texts, model = 'amazon.titan-embed-text-v1') {
        return realEmbeddingService_1.realEmbeddingService.embedBatch(texts, { model });
    }
    async healthCheck() {
        return realEmbeddingService_1.realEmbeddingService.healthCheck();
    }
}
exports.EmbeddingService = EmbeddingService;
exports.embeddingService = new EmbeddingService();
//# sourceMappingURL=embeddingService.js.map