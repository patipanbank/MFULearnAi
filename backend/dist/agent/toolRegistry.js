"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolRegistry = void 0;
exports.createMemoryTool = createMemoryTool;
exports.addChatMemory = addChatMemory;
exports.clearChatMemory = clearChatMemory;
exports.getMemoryStats = getMemoryStats;
const toolRegistry_1 = require("../services/toolRegistry");
const memoryService_1 = require("../services/memoryService");
const axios_1 = __importDefault(require("axios"));
exports.toolRegistry = {
    web_search: {
        name: 'web_search',
        description: 'Search the web for current information. Use this when you need up-to-date information that\'s not in your training data.',
        func: async (input) => {
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
                if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) {
                    const gUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(input)}`;
                    const gResp = await axios_1.default.get(gUrl, { timeout: 7000 });
                    if (gResp.data && gResp.data.items && gResp.data.items.length > 0) {
                        return gResp.data.items.slice(0, 3).map((item, i) => `${i + 1}. ${item.title}\n${item.snippet}\n${item.link}`).join('\n');
                    }
                }
                return 'No specific results found.';
            }
            catch (e) {
                return `Web search error: ${e.message}`;
            }
        }
    },
    calculator: {
        name: 'calculator',
        description: 'Calculate mathematical expressions. Use this for any mathematical calculations.',
        func: async (input) => {
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
        func: toolRegistry_1.toolRegistry.memory_search
    },
    memory_embed: {
        name: 'memory_embed',
        description: 'Embed new message into chat memory.',
        func: toolRegistry_1.toolRegistry.memory_embed
    }
};
function createMemoryTool(sessionId) {
    return {
        [`search_chat_memory_${sessionId}`]: {
            name: `search_chat_memory_${sessionId}`,
            description: 'Search through the current chat session history to find relevant context.',
            func: (input) => exports.toolRegistry.memory_search.func(input, sessionId)
        },
        [`embed_chat_memory_${sessionId}`]: {
            name: `embed_chat_memory_${sessionId}`,
            description: 'Embed new message into chat memory for this session.',
            func: (input) => exports.toolRegistry.memory_embed.func(input, sessionId)
        },
        [`recent_context_${sessionId}`]: {
            name: `recent_context_${sessionId}`,
            description: 'Get recent context from memory (last 10 messages in Redis).',
            func: async () => {
                const recent = await memoryService_1.memoryService.getRecentMessages(sessionId);
                if (!recent.length)
                    return 'No recent context found in memory.';
                return recent.map((msg, i) => `${i + 1}. ${msg.role}: ${msg.content}`).join('\n');
            }
        },
        [`full_context_${sessionId}`]: {
            name: `full_context_${sessionId}`,
            description: 'Get full conversation context from memory (ChromaDB).',
            func: async () => {
                const all = await toolRegistry_1.toolRegistry.memory_search('', sessionId, { k: 100 });
                return all || 'No context found in memory.';
            }
        },
        [`clear_memory_${sessionId}`]: {
            name: `clear_memory_${sessionId}`,
            description: 'Clear all chat memory for this session.',
            func: async () => {
                await memoryService_1.memoryService.clearRecentMessages(sessionId);
                await memoryService_1.memoryService.clearLongTermMemory(sessionId);
                return 'Memory cleared.';
            }
        },
        [`memory_stats_${sessionId}`]: {
            name: `memory_stats_${sessionId}`,
            description: 'Get memory usage statistics for this session.',
            func: async () => {
                return 'Memory stats: (not implemented in this version)';
            }
        }
    };
}
async function addChatMemory(sessionId, messages) {
    for (const msg of messages) {
        await exports.toolRegistry.memory_embed.func(msg.content, sessionId);
    }
}
async function clearChatMemory(sessionId) {
    await memoryService_1.memoryService.clearRecentMessages(sessionId);
    await memoryService_1.memoryService.clearLongTermMemory(sessionId);
}
async function getMemoryStats(sessionId) {
    return 'Memory stats: (not implemented in this version)';
}
//# sourceMappingURL=toolRegistry.js.map