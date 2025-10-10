"use strict";
/**
 * Memory Service stub - LangGraph now handles memory with StateGraph checkpointer
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryService = void 0;
exports.memoryService = {
    getConversationContext: async (sessionId, query) => ({}),
    searchMemory: async (sessionId, query, limit) => ([]),
    addMessage: async (sessionId, message) => { },
    embedMessage: async (sessionId, content) => { }
};
//# sourceMappingURL=memoryService.js.map