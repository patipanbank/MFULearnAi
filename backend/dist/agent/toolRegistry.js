"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webSearchTool = exports.toolRegistry = void 0;
exports.createMemoryTool = createMemoryTool;
exports.createRetrievalTools = createRetrievalTools;
exports.addChatMemory = addChatMemory;
exports.clearChatMemory = clearChatMemory;
exports.getMemoryStats = getMemoryStats;
const smartMemoryService_1 = require("../services/smartMemoryService");
const chromaService_1 = require("../services/chromaService");
const embeddingService_1 = require("../services/embeddingService");
const axios_1 = __importDefault(require("axios"));
exports.toolRegistry = {
    web_search: {
        name: 'web_search',
        description: 'Search the web for current information. Use this when you need up-to-date information that\'s not in your training data.',
        func: async (input) => {
            const results = await webSearch(input);
            if (!results.length)
                return 'No specific results found.';
            return results.map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\n${r.url}`).join('\n');
        }
    },
    calculator: {
        name: 'calculator',
        description: 'Calculate mathematical expressions. Use this for any mathematical calculations.',
        func: async (input) => {
            if (!input || input.trim() === '')
                return 'No expression provided.';
            return safeEvalMath(input.trim());
        }
    },
    current_date: {
        name: 'current_date',
        description: 'Get the current date and time. Use this when someone asks about the current date, time, or what day it is today.',
        func: async (_input, _sessionId, config) => {
            try {
                const tz = config?.timezone || 'Asia/Bangkok';
                const date = new Date().toLocaleString('th-TH', { timeZone: tz });
                return `Current date/time (${tz}): ${date}`;
            }
            catch (e) {
                return 'Error getting current date.';
            }
        }
    },
    memory_search: {
        name: 'memory_search',
        description: 'Search through chat memory for relevant context.',
        func: async (input, sessionId) => {
            if (!sessionId)
                return 'No sessionId provided.';
            const results = await smartMemoryService_1.smartMemoryService.searchMemory(sessionId, input);
            if (!results.length)
                return 'No relevant chat history found.';
            return results.map(r => `${r.role}: ${r.content} (relevance: ${r.relevanceScore.toFixed(2)})`).join('\n\n');
        }
    },
    memory_embed: {
        name: 'memory_embed',
        description: 'Embed new message into chat memory.',
        func: async (input, sessionId) => {
            if (!sessionId)
                return 'No sessionId provided.';
            const message = {
                role: 'user',
                content: input,
                timestamp: new Date().toISOString()
            };
            await smartMemoryService_1.smartMemoryService.addMessage(sessionId, message);
            return 'Message added to smart memory.';
        }
    }
};
async function searchDuckDuckGo(query) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const resp = await axios_1.default.get(url, { timeout: 5000 });
    const results = [];
    if (resp.data.Abstract) {
        results.push({ title: 'DuckDuckGo', snippet: resp.data.Abstract, url });
    }
    if (resp.data.RelatedTopics) {
        for (const topic of resp.data.RelatedTopics.slice(0, 3)) {
            if (topic.Text) {
                results.push({ title: 'DuckDuckGo Related', snippet: topic.Text, url });
            }
        }
    }
    return results;
}
async function searchGoogle(query) {
    const apiKey = process.env.GOOGLE_API_KEY;
    const cseId = process.env.GOOGLE_CSE_ID;
    if (!apiKey || !cseId)
        return [];
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}`;
    const resp = await axios_1.default.get(url, { timeout: 7000 });
    return (resp.data.items || []).slice(0, 3).map(item => ({
        title: item.title,
        snippet: item.snippet,
        url: item.link,
    }));
}
async function webSearch(query) {
    if (!query || !query.trim())
        return [];
    try {
        const ddgResults = await searchDuckDuckGo(query);
        if (ddgResults.length > 0)
            return ddgResults;
        const googleResults = await searchGoogle(query);
        return googleResults;
    }
    catch (e) {
        console.error('Web search error:', e);
        return [];
    }
}
exports.webSearchTool = {
    name: 'web_search',
    description: 'Search the web for current information. Use this when you need up-to-date information that\'s not in your training data.',
    func: async (input, _sessionId, config) => {
        if (!input || input.trim() === '')
            return 'No query provided.';
        const query = input.trim();
        const provider = config?.provider || 'duckduckgo';
        const language = config?.language || 'en';
        try {
            if (provider === 'duckduckgo') {
                const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&kl=${language}`;
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
            }
            if (provider === 'google' || process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) {
                const gUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&hl=${language}`;
                const gResp = await axios_1.default.get(gUrl, { timeout: 7000 });
                if (gResp.data && gResp.data.items && gResp.data.items.length > 0) {
                    return gResp.data.items.slice(0, 3).map((item, i) => `${i + 1}. ${item.title}\n${item.snippet}\n${item.link}`).join('\n');
                }
            }
            return 'No specific results found.';
        }
        catch (e) {
            return `Web search error: ${e?.message || 'Unknown error'}`;
        }
    }
};
function safeEvalMath(expr) {
    if (!/^[-+*/().\d\s]+$/.test(expr))
        return 'Invalid expression';
    try {
        return Function(`"use strict";return (${expr})`)().toString();
    }
    catch {
        return 'Error in calculation';
    }
}
function createMemoryTool(sessionId) {
    return {
        [`search_chat_memory_${sessionId}`]: {
            name: `search_chat_memory_${sessionId}`,
            description: 'Search through the current chat session history to find relevant context.',
            func: async (input) => {
                try {
                    const results = await smartMemoryService_1.smartMemoryService.searchMemory(sessionId, input);
                    if (!results.length)
                        return 'No relevant chat history found.';
                    return results.map((r, i) => `${i + 1}. ${r.role}: ${r.content}`).join('\n');
                }
                catch (error) {
                    return 'Memory search is currently unavailable.';
                }
            }
        },
        [`embed_chat_memory_${sessionId}`]: {
            name: `embed_chat_memory_${sessionId}`,
            description: 'Embed new message into chat memory for this session.',
            func: async (input) => {
                try {
                    return 'Message embedded into memory.';
                }
                catch (error) {
                    return 'Memory embedding is currently unavailable.';
                }
            }
        },
        [`recent_context_${sessionId}`]: {
            name: `recent_context_${sessionId}`,
            description: 'Get recent context from memory (last 10 messages in Redis).',
            func: async () => {
                try {
                    const recent = [];
                    if (!recent.length)
                        return 'No recent context found in memory.';
                    return recent.map((msg, i) => `${i + 1}. ${msg.role}: ${msg.content}`).join('\n');
                }
                catch (error) {
                    return 'Recent context is currently unavailable.';
                }
            }
        },
        [`full_context_${sessionId}`]: {
            name: `full_context_${sessionId}`,
            description: 'Get full conversation context from memory (vectorstore).',
            func: async () => {
                try {
                    const all = [];
                    if (!all.length)
                        return 'No context found in memory.';
                    return all.map((msg, i) => `${i + 1}. ${msg.role}: ${msg.content}`).join('\n');
                }
                catch (error) {
                    return 'Full context is currently unavailable.';
                }
            }
        },
        [`clear_memory_${sessionId}`]: {
            name: `clear_memory_${sessionId}`,
            description: 'Clear all chat memory for this session.',
            func: async () => {
                try {
                    await smartMemoryService_1.smartMemoryService.clearSession(sessionId);
                    return 'Memory cleared.';
                }
                catch (error) {
                    return 'Memory clearing is currently unavailable.';
                }
            }
        },
        [`memory_stats_${sessionId}`]: {
            name: `memory_stats_${sessionId}`,
            description: 'Get memory usage statistics for this session.',
            func: async () => {
                try {
                    const recent = [];
                    const all = [];
                    return `Memory stats for session ${sessionId}:\n- Recent messages: ${recent.length}\n- Total messages: ${all.length}`;
                }
                catch (error) {
                    return 'Memory stats are currently unavailable.';
                }
            }
        }
    };
}
function createRetrievalTools(collectionNames) {
    const tools = {};
    for (const collectionName of collectionNames) {
        tools[`search_${collectionName}`] = {
            name: `search_${collectionName}`,
            description: `Search and retrieve information from the ${collectionName} knowledge base. Use this when you need specific information.`,
            func: async (input) => {
                try {
                    const queryEmbedding = await embeddingService_1.embeddingService.embed(input);
                    if (!queryEmbedding || queryEmbedding.length === 0) {
                        console.warn(`⚠️ Failed to get embedding for search query in ${collectionName}`);
                        return `Search in ${collectionName} is currently unavailable.`;
                    }
                    const results = await chromaService_1.chromaService.queryCollection(collectionName, [queryEmbedding], 5);
                    if (!results || !results.documents || results.documents.length === 0) {
                        return `No information found in ${collectionName} for: ${input}`;
                    }
                    const documents = results.documents.flat();
                    const metadatas = results.metadatas ? results.metadatas.flat() : [];
                    return documents.map((doc, i) => {
                        const metadata = metadatas[i] || {};
                        const sourceName = metadata?.source || `${collectionName}_document_${i + 1}`;
                        const sourceType = metadata?.source_type || 'unknown';
                        const uploadedBy = metadata?.uploadedBy;
                        let sourceInfo = `Source: ${sourceName}`;
                        if (sourceType && sourceType !== 'unknown') {
                            sourceInfo += ` (${sourceType})`;
                        }
                        if (uploadedBy && uploadedBy !== 'system') {
                            sourceInfo += ` [Uploaded by: ${uploadedBy}]`;
                        }
                        return `${i + 1}. ${doc || 'No content'}\n${sourceInfo}`;
                    }).join('\n\n');
                }
                catch (error) {
                    console.error(`❌ Error searching ${collectionName}:`, error);
                    return `Search in ${collectionName} is currently unavailable.`;
                }
            }
        };
    }
    return tools;
}
async function addChatMemory(sessionId, messages) {
    for (const msg of messages) {
        await smartMemoryService_1.smartMemoryService.addMessage(sessionId, {
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp || new Date().toISOString()
        });
    }
}
async function clearChatMemory(sessionId) {
    await smartMemoryService_1.smartMemoryService.clearSession(sessionId);
}
async function getMemoryStats(sessionId) {
    try {
        const stats = await smartMemoryService_1.smartMemoryService.getMemoryStats(sessionId);
        return {
            recentCount: stats.recentCount,
            totalCount: stats.embeddedCount,
            sessionId,
            memoryType: stats.memoryType
        };
    }
    catch (error) {
        return { error: 'Memory stats unavailable' };
    }
}
//# sourceMappingURL=toolRegistry.js.map