"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLLM = getLLM;
const bedrock_1 = require("@langchain/community/chat_models/bedrock");
function getLLM(modelId, streaming = true, temperature = 0.7, maxTokens = 4000) {
    const region = process.env.AWS_REGION || 'us-east-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) {
        throw new Error('AWS credentials not configured');
    }
    return new bedrock_1.ChatBedrock({
        model: modelId,
        region,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        streaming,
        temperature,
        maxTokens,
    });
}
//# sourceMappingURL=llmFactory.js.map