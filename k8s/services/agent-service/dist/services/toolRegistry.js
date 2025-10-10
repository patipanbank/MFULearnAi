"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolRegistry = void 0;
// Legacy imports - stubs for backwards compatibility
const chromaService_1 = require("./chromaService");
const axios_1 = __importDefault(require("axios"));
const bedrockService_1 = require("./bedrockService");
// Static tool registry (default tools)
const staticTools = {
    calculator: async (input) => {
        if (!input || input.trim() === '')
            return 'No expression provided.';
        try {
            if (!/^[-+*/().\d\s]+$/.test(input))
                return 'Invalid expression';
            // eslint-disable-next-line no-eval
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
            // Generate embedding for the query text
            const queryEmbedding = await bedrockService_1.bedrockService.createTextEmbedding(input); // ใช้ bedrockService
            if (!queryEmbedding || !queryEmbedding.embedding || queryEmbedding.embedding.length === 0) {
                return 'Failed to generate embedding for query.';
            }
            const k = config?.k || 3;
            const result = await chromaService_1.chromaService.queryCollection(`chat_memory_${sessionId}`, [queryEmbedding], k); // ส่ง queryEmbeddings
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
            // Generate embedding for the input text
            const embedding = await bedrockService_1.bedrockService.createTextEmbedding(input); // ใช้ bedrockService
            if (!embedding || !embedding.embedding || embedding.embedding.length === 0) {
                return 'Failed to generate embedding for content.';
            }
            const hash = Buffer.from(input).toString('base64');
            const existing = await chromaService_1.chromaService.getDocuments(`chat_memory_${sessionId}`);
            if (existing.documents.some((doc) => Buffer.from(doc.document).toString('base64') === hash)) {
                return 'Already embedded.';
            }
            await chromaService_1.chromaService.addToCollection(`chat_memory_${sessionId}`, [input], [embedding.embedding], [Date.now().toString()]); // ส่ง embedding
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
            console.log(`🔍 Web search query: ${input}`);
            // ลองใช้ Google Search API ก่อน (เหมือน Legacy)
            if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) {
                console.log(`🔍 Using Google Search API`);
                const gUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(input)}&num=3`;
                const gResp = await axios_1.default.get(gUrl, { timeout: 7000 });
                if (gResp.data && gResp.data.items && gResp.data.items.length > 0) {
                    const results = gResp.data.items.map((item, i) => `${i + 1}. ${item.title}\n${item.snippet}\n${item.link}`).join('\n\n');
                    console.log(`🔍 Google Search results: ${results.substring(0, 100)}...`);
                    return results;
                }
            }
            // Fallback ไปใช้ DuckDuckGo (เหมือน Legacy)
            console.log(`🔍 Using DuckDuckGo API`);
            const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(input)}&format=json&no_html=1&skip_disambig=1`;
            const resp = await axios_1.default.get(url, { timeout: 5000 });
            if (resp.data && resp.data.Abstract) {
                const result = `DuckDuckGo: ${resp.data.Abstract}`;
                console.log(`🔍 DuckDuckGo result: ${result.substring(0, 100)}...`);
                return result;
            }
            if (resp.data && resp.data.RelatedTopics && resp.data.RelatedTopics.length > 0) {
                const topics = resp.data.RelatedTopics.slice(0, 3).map((t) => t.Text).filter(Boolean);
                if (topics.length > 0) {
                    const result = `DuckDuckGo related: ${topics.join(' | ')}`;
                    console.log(`🔍 DuckDuckGo related: ${result.substring(0, 100)}...`);
                    return result;
                }
            }
            return 'No specific results found.';
        }
        catch (e) {
            console.error(`❌ Web search error: ${e.message}`);
            return `Web search error: ${e.message}`;
        }
    }
};
// Dynamic tool registry (mock, ไม่ใช้ DB จริง)
let dynamicTools = {};
// export async function reloadDynamicTools() {
//   // โหลด tool จาก database/config (ToolModel)
//   try {
//     const tools = await ToolModel.find({ enabled: true });
//     const reg: Record<string, ToolFunction> = {};
//     for (const tool of tools) {
//       // tool.type, tool.config, tool.endpoint, tool.code, ...
//       if (tool.type === 'http') {
//         reg[tool.name] = async (input: string, sessionId: string, config?: any) => {
//           try {
//             const resp = await axios.post(tool.endpoint, { input, sessionId, ...config });
//             return resp.data?.result || JSON.stringify(resp.data);
//           } catch (e) {
//             return `Dynamic tool error: ${(e as Error).message}`;
//           }
//         };
//       } else if (tool.type === 'code') {
//         reg[tool.name] = async (input: string, sessionId: string, config?: any) => {
//           try {
//             // eslint-disable-next-line no-new-func
//             const fn = new Function('input', 'sessionId', 'config', tool.code);
//             return await fn(input, sessionId, config);
//           } catch (e) {
//             return `Dynamic tool error: ${(e as Error).message}`;
//           }
//         };
//       }
//     }
//     dynamicTools = reg;
//     console.log(`[ToolRegistry] Reloaded dynamic tools: ${Object.keys(dynamicTools).join(', ')}`);
//   } catch (e) {
//     console.error('[ToolRegistry] Failed to reload dynamic tools:', e);
//   }
// }
// setInterval(reloadDynamicTools, 60000);
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