"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.embeddingService = exports.EmbeddingService = void 0;
const bedrockService_1 = require("./bedrockService");
class EmbeddingService {
    async getTextEmbeddings(input, model = 'amazon.titan-embed-text-v1') {
        return bedrockService_1.bedrockService.createBatchTextEmbeddings(input);
    }
    async embed(text, model = 'amazon.titan-embed-text-v1') {
        const embeddings = await this.getTextEmbeddings([text], model);
        return embeddings && embeddings.length > 0 ? embeddings[0] : [];
    }
    async embedBatch(texts, model = 'amazon.titan-embed-text-v1') {
        return this.getTextEmbeddings(texts, model);
    }
}
exports.EmbeddingService = EmbeddingService;
exports.embeddingService = new EmbeddingService();
//# sourceMappingURL=embeddingService.js.map