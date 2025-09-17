"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLegacyLangMemTools = exports.createLangMemTools = exports.LangMemTools = void 0;
function createManageMemoryTool(config) {
    return null;
}
function createSearchMemoryTool(config) {
    return null;
}
const langmemService_1 = require("./langmemService");
class LangMemTools {
    static createMemoryTools(config) {
        const context = {
            sessionId: config.sessionId,
            userId: config.userId,
            agentId: config.agentId,
            namespace: config.namespace || 'default'
        };
        return {
            manage_memory: this.createManageMemoryTool(context),
            search_memory: this.createSearchMemoryTool(context),
            add_memory: this.createAddMemoryTool(context),
            get_memory_context: this.createGetContextTool(context),
            clear_memory: this.createClearMemoryTool(context),
            memory_stats: this.createMemoryStatsTool(context)
        };
    }
    static createManageMemoryTool(context) {
        return async (input, sessionId) => {
            try {
                console.log(`🧠 Managing memory: ${input}`);
                const actualContext = sessionId
                    ? { ...context, sessionId }
                    : context;
                const messages = [{
                        role: 'user',
                        content: input,
                        timestamp: new Date().toISOString()
                    }];
                const processedMemories = await langmemService_1.langmemService.processMessages(messages, actualContext);
                if (processedMemories.length > 0) {
                    return `Successfully processed and stored ${processedMemories.length} memory entries from the conversation.`;
                }
                else {
                    return 'No significant information found to store in memory.';
                }
            }
            catch (error) {
                console.error('❌ Error in manage_memory tool:', error);
                return `Error managing memory: ${error.message}`;
            }
        };
    }
    static createSearchMemoryTool(context) {
        return async (input, sessionId) => {
            try {
                console.log(`🔍 Searching memory: ${input}`);
                const actualContext = sessionId
                    ? { ...context, sessionId }
                    : context;
                const memories = await langmemService_1.langmemService.searchMemories(input, actualContext, {
                    limit: 5,
                    minRelevance: 0.3
                });
                if (memories.length === 0) {
                    return 'No relevant memories found for your query.';
                }
                const memoryTexts = memories.map((memory, index) => `${index + 1}. ${memory.content} (relevance: ${(memory.metadata.relevance || 0).toFixed(2)})`).join('\n');
                return `Found ${memories.length} relevant memories:\n${memoryTexts}`;
            }
            catch (error) {
                console.error('❌ Error in search_memory tool:', error);
                return `Error searching memory: ${error.message}`;
            }
        };
    }
    static createAddMemoryTool(context) {
        return async (input, sessionId) => {
            try {
                console.log(`💾 Adding memory: ${input}`);
                const actualContext = sessionId
                    ? { ...context, sessionId }
                    : context;
                const lines = input.split('\n');
                let content = input;
                let type = 'fact';
                if (lines.length > 1 && lines[0].toLowerCase().includes('type:')) {
                    type = lines[0].replace(/type:\s*/i, '').trim();
                    content = lines.slice(1).join('\n').trim();
                }
                const memory = await langmemService_1.langmemService.addMemory(content, actualContext, {
                    type,
                    metadata: { source: 'manual_addition' }
                });
                return `Successfully added memory (${memory.type}): ${content.substring(0, 100)}...`;
            }
            catch (error) {
                console.error('❌ Error in add_memory tool:', error);
                return `Error adding memory: ${error.message}`;
            }
        };
    }
    static createGetContextTool(context) {
        return async (input, sessionId) => {
            try {
                console.log(`📖 Getting memory context: ${input}`);
                const actualContext = sessionId
                    ? { ...context, sessionId }
                    : context;
                const options = { limit: 10 };
                if (input.includes('type:')) {
                    const typeMatch = input.match(/type:\s*(\w+)/i);
                    if (typeMatch) {
                        options.includeTypes = [typeMatch[1]];
                    }
                }
                if (input.includes('limit:')) {
                    const limitMatch = input.match(/limit:\s*(\d+)/i);
                    if (limitMatch) {
                        options.limit = parseInt(limitMatch[1]);
                    }
                }
                const memories = await langmemService_1.langmemService.getContextualMemories(actualContext, options);
                if (memories.length === 0) {
                    return 'No contextual memories found.';
                }
                const contextInfo = memories.map((memory, index) => `${index + 1}. [${memory.type}] ${memory.content}`).join('\n');
                return `Contextual memories (${memories.length} entries):\n${contextInfo}`;
            }
            catch (error) {
                console.error('❌ Error in get_memory_context tool:', error);
                return `Error getting memory context: ${error.message}`;
            }
        };
    }
    static createClearMemoryTool(context) {
        return async (input, sessionId) => {
            try {
                console.log(`🧹 Clearing memory: ${input}`);
                const actualContext = sessionId
                    ? { ...context, sessionId }
                    : context;
                await langmemService_1.langmemService.clearMemories(actualContext);
                return 'Successfully cleared all memories for this session.';
            }
            catch (error) {
                console.error('❌ Error in clear_memory tool:', error);
                return `Error clearing memory: ${error.message}`;
            }
        };
    }
    static createMemoryStatsTool(context) {
        return async (input, sessionId) => {
            try {
                console.log(`📊 Getting memory stats: ${input}`);
                const actualContext = sessionId
                    ? { ...context, sessionId }
                    : context;
                const stats = await langmemService_1.langmemService.getMemoryStats(actualContext);
                const typeBreakdownText = Object.entries(stats.typeBreakdown)
                    .map(([type, count]) => `  ${type}: ${count}`)
                    .join('\n');
                return `Memory Statistics:
- Total memories: ${stats.totalMemories}
- Namespace: ${stats.namespaceInfo}
- Type breakdown:
${typeBreakdownText}
- Oldest memory: ${stats.oldestMemory || 'N/A'}
- Newest memory: ${stats.newestMemory || 'N/A'}`;
            }
            catch (error) {
                console.error('❌ Error in memory_stats tool:', error);
                return `Error getting memory stats: ${error.message}`;
            }
        };
    }
    static createLegacyMemoryTools(sessionId) {
        const context = {
            sessionId,
            namespace: 'legacy'
        };
        return {
            [`memory_search_${sessionId}`]: async (input) => {
                const memories = await langmemService_1.langmemService.searchMemory(sessionId, input, 3);
                if (memories.length === 0)
                    return 'No relevant memories found.';
                return memories.map((m, i) => `${i + 1}. ${m.content} (relevance: ${m.relevanceScore.toFixed(2)})`).join('\n');
            },
            [`memory_embed_${sessionId}`]: async (input) => {
                await langmemService_1.langmemService.embedMessage(sessionId, input);
                return 'Message embedded into memory successfully.';
            },
            [`recent_context_${sessionId}`]: async (input) => {
                const messages = await langmemService_1.langmemService.getRecentMessages(sessionId);
                if (messages.length === 0)
                    return 'No recent messages found.';
                return messages.map((m, i) => `${i + 1}. ${m.content}`).join('\n');
            },
            [`clear_memory_${sessionId}`]: async (input) => {
                await langmemService_1.langmemService.clearAllMemory(sessionId);
                return 'All memory cleared for this session.';
            },
            [`memory_stats_${sessionId}`]: async (input) => {
                const stats = await langmemService_1.langmemService.getMemoryStats(context);
                return `Memory Stats: ${stats.totalMemories} total memories, ${Object.keys(stats.typeBreakdown).length} types`;
            }
        };
    }
}
exports.LangMemTools = LangMemTools;
const createLangMemTools = (config) => {
    return LangMemTools.createMemoryTools(config);
};
exports.createLangMemTools = createLangMemTools;
const createLegacyLangMemTools = (sessionId) => {
    return LangMemTools.createLegacyMemoryTools(sessionId);
};
exports.createLegacyLangMemTools = createLegacyLangMemTools;
//# sourceMappingURL=langmemTools.js.map