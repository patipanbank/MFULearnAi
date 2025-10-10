"use strict";
/**
 * Bedrock Service stub - ChatBedrockConverse used directly in LangGraph
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bedrockService = void 0;
exports.bedrockService = {
    invoke: async (params) => {
        console.warn('bedrockService stub - use ChatBedrockConverse instead');
        return {};
    },
    createTextEmbedding: async (text) => {
        console.warn('bedrockService.createTextEmbedding stub');
        return { embedding: [] };
    }
};
//# sourceMappingURL=bedrockService.js.map