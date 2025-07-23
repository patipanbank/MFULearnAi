"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolRegistry = void 0;
const chromaService_1 = require("./chromaService");
const axios_1 = __importDefault(require("axios"));
const bedrockService_1 = require("./bedrockService");
const staticTools = {
    calculator: async (input) => {
        if (!input || input.trim() === '')
            return 'No expression provided.';
        try {
            if (!/^[-+*/().\d\s]+$/.test(input))
                return 'Invalid expression';
            return eval(input).toString();
        }
        catch (e) {
            return 'Error in calculation';
        }
    },
    current_date: async (_input, _sessionId, config) => {
        try {
            const tz = config?.timezone || 'Asia/Bangkok';
            const date = new Date().toLocaleString('th-TH', { timeZone: tz });
            return `Current date/time (${tz}): ${date}`;
        }
        catch (e) {
            return 'Error getting current date.';
        }
    },
    memory_search: async (input, sessionId, config) => {
        try {
            const queryEmbedding = await bedrockService_1.bedrockService.createTextEmbedding(input);
            if (!queryEmbedding || queryEmbedding.length === 0) {
                return 'Failed to generate embedding for query.';
            }
            const k = config?.k || 3;
            const result = await chromaService_1.chromaService.queryCollection(`chat_memory_${sessionId}`, [queryEmbedding], k);
            if (result && result.documents && result.documents.length > 0) {
                const seen = new Set();
                const docs = result.documents.filter((doc) => {
                    if (seen.has(doc.id))
                        return false;
                    seen.add(doc.id);
                    return true;
                });
                return docs.map((doc, i) => `${i + 1}. ${doc.document}`).join('\n');
            }
            return 'No relevant memory found.';
        }
        catch (e) {
            return `Memory search error: ${e.message}`;
        }
    },
    memory_embed: async (input, sessionId, config) => {
        try {
            if (!input || input.trim() === '')
                return 'No content to embed.';
            const embedding = await bedrockService_1.bedrockService.createTextEmbedding(input);
            if (!embedding || embedding.length === 0) {
                return 'Failed to generate embedding for content.';
            }
            const hash = Buffer.from(input).toString('base64');
            const existing = await chromaService_1.chromaService.getDocuments(`chat_memory_${sessionId}`);
            if (existing.documents.some((doc) => Buffer.from(doc.document).toString('base64') === hash)) {
                return 'Already embedded.';
            }
            await chromaService_1.chromaService.addToCollection(`chat_memory_${sessionId}`, [input], [embedding], [{}], [Date.now().toString()]);
            return 'Memory embedded.';
        }
        catch (e) {
            return `Memory embed error: ${e.message}`;
        }
    },
    web_search: async (input, _sessionId, config) => {
        if (!input || input.trim() === '')
            return 'No query provided.';
        try {
            const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(input)}&format=json&no_html=1&skip_disambig=1`;
            const resp = await axios_1.default.get(url, { timeout: 5000 });
            if (resp.data && resp.data.Abstract) {
                return `DuckDuckGo: ${resp.data.Abstract}`;
            }
            if (resp.data && resp.data.RelatedTopics && resp.data.RelatedTopics.length > 0) {
                const topics = resp.data.RelatedTopics.slice(0, 3).map((t) => t.Text).filter(Boolean);
                if (topics.length > 0) {
                    return `DuckDuckGo related: ${topics.join(' | ')}`;
                }
            }
            return 'No specific results found.';
        }
        catch (e) {
            return `Web search error: ${e.message}`;
        }
    }
};
let dynamicTools = {};
exports.toolRegistry = new Proxy({}, {
    get(_target, prop) {
        if (dynamicTools[prop])
            return dynamicTools[prop];
        if (staticTools[prop])
            return staticTools[prop];
        return async () => `Tool "${prop}" not found.`;
    }
});
//# sourceMappingURL=toolRegistry.js.map