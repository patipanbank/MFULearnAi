"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.embeddingService = exports.EmbeddingService = void 0;
const bedrockService_1 = require("./bedrockService");
class EmbeddingService {
    async getTextEmbeddings(input, model = 'amazon.titan-embed-text-v1') {
        return bedrockService_1.bedrockService.createBatchTextEmbeddings(input);
    }
}
exports.EmbeddingService = EmbeddingService;
exports.embeddingService = new EmbeddingService();
//# sourceMappingURL=embeddingService.js.map