"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLM = void 0;
exports.getLLM = getLLM;
const bedrock_1 = require("@langchain/community/chat_models/bedrock");
class LLM {
    constructor(options) {
        this.options = options;
        this.chat = new bedrock_1.BedrockChat({
            region: options.region || process.env.AWS_REGION,
            model: options.model,
            credentials: {
                accessKeyId: options.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
            },
            maxTokens: options.maxTokens,
            temperature: options.temperature,
            topP: options.topP,
            topK: options.topK,
            systemPrompt: options.systemPrompt,
        });
    }
    async generate(messages) {
        const response = await this.chat.invoke(messages);
        return response.content;
    }
}
exports.LLM = LLM;
function getLLM(options) {
    return new LLM(options);
}
//# sourceMappingURL=llmFactory.js.map