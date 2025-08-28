"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolRegistry = exports.toolMetadata = void 0;
exports.createSessionTools = createSessionTools;
exports.createKnowledgeTools = createKnowledgeTools;
exports.getAllTools = getAllTools;
const chromaService_1 = require("./chromaService");
const axios_1 = __importDefault(require("axios"));
const bedrockService_1 = require("./bedrockService");
function createSessionTools(sessionId) {
    const sessionTools = {};
    sessionTools[`search_chat_memory_${sessionId}`] = async (input) => {
        return await exports.toolRegistry.memory_search(input, sessionId);
    };
    sessionTools[`embed_chat_memory_${sessionId}`] = async (input) => {
        return await exports.toolRegistry.memory_embed(input, sessionId);
    };
    return sessionTools;
}
function createKnowledgeTools(collectionNames) {
    const knowledgeTools = {};
    for (const collectionName of collectionNames) {
        knowledgeTools[`search_${collectionName}`] = async (input) => {
            try {
                const { chromaService } = await Promise.resolve().then(() => __importStar(require('./chromaService')));
                const { bedrockService } = await Promise.resolve().then(() => __importStar(require('./bedrockService')));
                const queryEmbedding = await bedrockService.createTextEmbedding(input);
                if (!queryEmbedding || queryEmbedding.length === 0) {
                    return `Search in ${collectionName} is currently unavailable`;
                }
                const results = await chromaService.queryCollection(collectionName, [queryEmbedding], 5);
                if (!results?.documents?.length) {
                    return `No information found in ${collectionName} for: ${input}`;
                }
                const documents = results.documents.flat();
                const metadatas = results.metadatas?.flat() || [];
                return documents.slice(0, 3).map((doc, i) => {
                    const metadata = metadatas[i] || {};
                    const source = metadata?.source || `${collectionName}_doc_${i + 1}`;
                    return `${i + 1}. ${doc}\nSource: ${source}`;
                }).join('\n\n');
            }
            catch (error) {
                console.error(`Knowledge search error in ${collectionName}:`, error);
                return `Search in ${collectionName} currently unavailable`;
            }
        };
    }
    return knowledgeTools;
}
const staticTools = {
    calculator: async (input) => {
        if (!input || input.trim() === '')
            return 'No expression provided.';
        try {
            if (!/^[-+*/().\d\s]+$/.test(input))
                return 'Invalid mathematical expression';
            const result = Function(`"use strict"; return (${input})`)();
            return result.toString();
        }
        catch (e) {
            return `Calculation error: Please check your mathematical expression`;
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
        if (!sessionId)
            return 'Session ID required for memory search';
        if (!input?.trim())
            return 'Search query required';
        try {
            console.log(`🧠 Searching memory for session ${sessionId}: ${input}`);
            const queryEmbedding = await bedrockService_1.bedrockService.createTextEmbedding(input);
            if (!queryEmbedding || queryEmbedding.length === 0) {
                console.warn('Failed to generate embedding for memory search');
                return 'Memory search temporarily unavailable';
            }
            const k = config?.k || 5;
            const result = await chromaService_1.chromaService.queryCollection(`chat_memory_${sessionId}`, [queryEmbedding], k);
            if (result?.documents?.length > 0) {
                const documents = result.documents.flat();
                const relevantDocs = documents.slice(0, k);
                console.log(`🧠 Found ${relevantDocs.length} relevant memories`);
                return relevantDocs
                    .map((doc, i) => `${i + 1}. ${doc}`)
                    .join('\n');
            }
            return 'No relevant information found in conversation history';
        }
        catch (e) {
            console.error('Memory search error:', e);
            return 'Memory search currently unavailable';
        }
    },
    memory_embed: async (input, sessionId, config) => {
        if (!sessionId)
            return 'Session ID required for memory embedding';
        if (!input?.trim())
            return 'Content required for embedding';
        try {
            console.log(`🧠 Embedding memory for session ${sessionId}`);
            const embedding = await bedrockService_1.bedrockService.createTextEmbedding(input);
            if (!embedding || embedding.length === 0) {
                console.warn('Failed to generate embedding for memory');
                return 'Memory embedding temporarily unavailable';
            }
            const hash = Buffer.from(input.trim()).toString('base64').substring(0, 20);
            try {
                const existing = await chromaService_1.chromaService.getDocuments(`chat_memory_${sessionId}`);
                if (existing.documents?.some((doc) => doc.includes(hash))) {
                    return 'Information already stored in memory';
                }
            }
            catch (e) {
            }
            await chromaService_1.chromaService.addToCollection(`chat_memory_${sessionId}`, [input], [embedding], [{ timestamp: new Date().toISOString(), hash }], [Date.now().toString()]);
            console.log(`🧠 Successfully embedded memory for session ${sessionId}`);
            return 'Information stored in conversation memory';
        }
        catch (e) {
            console.error('Memory embedding error:', e);
            return 'Memory embedding currently unavailable';
        }
    },
    web_search: async (input, _sessionId, config) => {
        if (!input?.trim())
            return 'Search query required';
        const query = input.trim();
        console.log(`🔍 Web search: ${query}`);
        try {
            if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) {
                console.log('🔍 Using Google Custom Search');
                const gUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&num=5`;
                try {
                    const gResp = await axios_1.default.get(gUrl, { timeout: 8000 });
                    if (gResp.data?.items?.length > 0) {
                        const results = gResp.data.items
                            .slice(0, 3)
                            .map((item, i) => `${i + 1}. **${item.title}**\n${item.snippet}\nSource: ${item.link}`).join('\n\n');
                        console.log(`🔍 Google results: ${results.length} characters`);
                        return results;
                    }
                }
                catch (googleError) {
                    console.warn('Google Search failed, trying DuckDuckGo');
                }
            }
            console.log('🔍 Using DuckDuckGo');
            const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
            const ddgResp = await axios_1.default.get(ddgUrl, { timeout: 6000 });
            let results = '';
            if (ddgResp.data?.Abstract) {
                results += `**Summary:** ${ddgResp.data.Abstract}\n\n`;
            }
            if (ddgResp.data?.RelatedTopics?.length > 0) {
                const topics = ddgResp.data.RelatedTopics
                    .slice(0, 3)
                    .map((t) => t.Text)
                    .filter(Boolean);
                if (topics.length > 0) {
                    results += topics
                        .map((topic, i) => `${i + 1}. ${topic}`)
                        .join('\n');
                }
            }
            if (results) {
                console.log(`🔍 DuckDuckGo results: ${results.length} characters`);
                return results;
            }
            return `No current information found for "${query}". The topic may be too specific or recent.`;
        }
        catch (e) {
            console.error('Web search error:', e);
            return 'Web search is temporarily unavailable. Please try again later.';
        }
    }
};
function getAllTools(sessionId, collections = []) {
    const allTools = {
        calculator: staticTools.calculator,
        web_search: staticTools.web_search,
        current_date: staticTools.current_date,
        memory_search: (input) => staticTools.memory_search(input, sessionId),
        memory_embed: (input) => staticTools.memory_embed(input, sessionId),
        ...createSessionTools(sessionId),
        ...createKnowledgeTools(collections)
    };
    return allTools;
}
exports.toolMetadata = {
    calculator: {
        name: 'calculator',
        description: 'Perform mathematical calculations. Input: mathematical expression like "2+2" or "sqrt(16)"',
        category: 'utility',
        required_params: ['expression']
    },
    web_search: {
        name: 'web_search',
        description: 'Search the internet for current information. Input: search query',
        category: 'search',
        required_params: ['query']
    },
    current_date: {
        name: 'current_date',
        description: 'Get current date and time. No input required',
        category: 'utility',
        required_params: []
    },
    memory_search: {
        name: 'memory_search',
        description: 'Search conversation memory for relevant context. Input: search terms',
        category: 'memory',
        required_params: ['query']
    },
    memory_embed: {
        name: 'memory_embed',
        description: 'Store information in conversation memory. Input: information to remember',
        category: 'memory',
        required_params: ['content']
    }
};
exports.toolRegistry = new Proxy({}, {
    get(_target, prop) {
        if (staticTools[prop])
            return staticTools[prop];
        return async () => `Tool "${prop}" not found.`;
    }
});
//# sourceMappingURL=unifiedToolRegistry.js.map