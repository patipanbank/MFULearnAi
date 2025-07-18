"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getToolsForSession = getToolsForSession;
exports.addChatMemory = addChatMemory;
exports.clearChatMemory = clearChatMemory;
exports.getMemoryStats = getMemoryStats;
exports.createRetrieverTool = createRetrieverTool;
exports.getBedrockEmbeddings = getBedrockEmbeddings;
const tools_1 = require("langchain/tools");
const retriever_1 = require("langchain/tools/retriever");
const chatMemory = new Map();
const TOOL_REGISTRY = [];
function getToolsForSession(sessionId) {
    const tools = [...TOOL_REGISTRY];
    if (chatMemory.has(sessionId)) {
        const memoryTool = createMemoryTool(sessionId);
        tools.push(memoryTool);
    }
    return tools;
}
function createMemoryTool(sessionId) {
    class MemoryTool extends tools_1.Tool {
        constructor() {
            super(...arguments);
            this.name = 'search_chat_memory';
            this.description = 'Search through previous conversation history to find relevant information. Use this when you need to reference what was discussed earlier.';
        }
        async _call(input) {
            const memory = chatMemory.get(sessionId) || [];
            if (memory.length === 0) {
                return 'No previous conversation history available.';
            }
            const relevantMessages = memory.filter(msg => msg.content.toLowerCase().includes(input.toLowerCase()));
            if (relevantMessages.length === 0) {
                return 'No relevant information found in conversation history.';
            }
            return relevantMessages
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n');
        }
    }
    return new MemoryTool();
}
function addChatMemory(sessionId, messages) {
    chatMemory.set(sessionId, messages);
    console.log(`📚 Added ${messages.length} messages to memory for session ${sessionId}`);
}
function clearChatMemory(sessionId) {
    chatMemory.delete(sessionId);
    console.log(`🧹 Cleared memory for session ${sessionId}`);
}
function getMemoryStats() {
    return {
        totalSessions: chatMemory.size,
        totalMessages: Array.from(chatMemory.values()).reduce((sum, messages) => sum + messages.length, 0),
    };
}
function createRetrieverTool(collectionName, vectorStore) {
    const retriever = vectorStore.asRetriever({
        searchType: 'similarity',
        k: 5,
    });
    const tool = (0, retriever_1.createRetrieverTool)(retriever, {
        name: `search_${collectionName}`,
        description: `Search and retrieve information from the ${collectionName} knowledge base. Use this when you need specific information.`
    });
    return tool;
}
function getBedrockEmbeddings() {
    return {
        embedDocuments: async (documents) => {
            return documents.map(() => new Array(1536).fill(0));
        },
        embedQuery: async (text) => {
            return new Array(1536).fill(0);
        },
    };
}
//# sourceMappingURL=toolRegistry.js.map