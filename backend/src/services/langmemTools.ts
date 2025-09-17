// Mock LangMem tools for now
function createManageMemoryTool(config: any) {
  return null; // Not used in this implementation
}

function createSearchMemoryTool(config: any) {
  return null; // Not used in this implementation
}
import { langmemService, ConversationContext } from './langmemService';
import { ToolFunction } from './toolRegistry';

export interface LangMemToolConfig {
  sessionId: string;
  userId?: string;
  agentId?: string;
  namespace?: string;
}

export class LangMemTools {

  static createMemoryTools(config: LangMemToolConfig): { [name: string]: ToolFunction } {
    const context: ConversationContext = {
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

  static createManageMemoryTool(context: ConversationContext): ToolFunction {
    return async (input: string, sessionId?: string): Promise<string> => {
      try {
        console.log(`🧠 Managing memory: ${input}`);

        const actualContext = sessionId
          ? { ...context, sessionId }
          : context;

        // Parse input for message management
        const messages = [{
          role: 'user',
          content: input,
          timestamp: new Date().toISOString()
        }];

        const processedMemories = await langmemService.processMessages(messages, actualContext);

        if (processedMemories.length > 0) {
          return `Successfully processed and stored ${processedMemories.length} memory entries from the conversation.`;
        } else {
          return 'No significant information found to store in memory.';
        }

      } catch (error) {
        console.error('❌ Error in manage_memory tool:', error);
        return `Error managing memory: ${(error as Error).message}`;
      }
    };
  }

  static createSearchMemoryTool(context: ConversationContext): ToolFunction {
    return async (input: string, sessionId?: string): Promise<string> => {
      try {
        console.log(`🔍 Searching memory: ${input}`);

        const actualContext = sessionId
          ? { ...context, sessionId }
          : context;

        const memories = await langmemService.searchMemories(input, actualContext, {
          limit: 5,
          minRelevance: 0.3
        });

        if (memories.length === 0) {
          return 'No relevant memories found for your query.';
        }

        const memoryTexts = memories.map((memory, index) =>
          `${index + 1}. ${memory.content} (relevance: ${(memory.metadata.relevance || 0).toFixed(2)})`
        ).join('\n');

        return `Found ${memories.length} relevant memories:\n${memoryTexts}`;

      } catch (error) {
        console.error('❌ Error in search_memory tool:', error);
        return `Error searching memory: ${(error as Error).message}`;
      }
    };
  }

  static createAddMemoryTool(context: ConversationContext): ToolFunction {
    return async (input: string, sessionId?: string): Promise<string> => {
      try {
        console.log(`💾 Adding memory: ${input}`);

        const actualContext = sessionId
          ? { ...context, sessionId }
          : context;

        // Parse input for type and content
        const lines = input.split('\n');
        let content = input;
        let type = 'fact';

        if (lines.length > 1 && lines[0].toLowerCase().includes('type:')) {
          type = lines[0].replace(/type:\s*/i, '').trim();
          content = lines.slice(1).join('\n').trim();
        }

        const memory = await langmemService.addMemory(content, actualContext, {
          type,
          metadata: { source: 'manual_addition' }
        });

        return `Successfully added memory (${memory.type}): ${content.substring(0, 100)}...`;

      } catch (error) {
        console.error('❌ Error in add_memory tool:', error);
        return `Error adding memory: ${(error as Error).message}`;
      }
    };
  }

  static createGetContextTool(context: ConversationContext): ToolFunction {
    return async (input: string, sessionId?: string): Promise<string> => {
      try {
        console.log(`📖 Getting memory context: ${input}`);

        const actualContext = sessionId
          ? { ...context, sessionId }
          : context;

        // Parse input for options
        const options: any = { limit: 10 };

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

        const memories = await langmemService.getContextualMemories(actualContext, options);

        if (memories.length === 0) {
          return 'No contextual memories found.';
        }

        const contextInfo = memories.map((memory, index) =>
          `${index + 1}. [${memory.type}] ${memory.content}`
        ).join('\n');

        return `Contextual memories (${memories.length} entries):\n${contextInfo}`;

      } catch (error) {
        console.error('❌ Error in get_memory_context tool:', error);
        return `Error getting memory context: ${(error as Error).message}`;
      }
    };
  }

  static createClearMemoryTool(context: ConversationContext): ToolFunction {
    return async (input: string, sessionId?: string): Promise<string> => {
      try {
        console.log(`🧹 Clearing memory: ${input}`);

        const actualContext = sessionId
          ? { ...context, sessionId }
          : context;

        await langmemService.clearMemories(actualContext);
        return 'Successfully cleared all memories for this session.';

      } catch (error) {
        console.error('❌ Error in clear_memory tool:', error);
        return `Error clearing memory: ${(error as Error).message}`;
      }
    };
  }

  static createMemoryStatsTool(context: ConversationContext): ToolFunction {
    return async (input: string, sessionId?: string): Promise<string> => {
      try {
        console.log(`📊 Getting memory stats: ${input}`);

        const actualContext = sessionId
          ? { ...context, sessionId }
          : context;

        const stats = await langmemService.getMemoryStats(actualContext);

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

      } catch (error) {
        console.error('❌ Error in memory_stats tool:', error);
        return `Error getting memory stats: ${(error as Error).message}`;
      }
    };
  }

  // Legacy compatibility tools
  static createLegacyMemoryTools(sessionId: string): { [name: string]: ToolFunction } {
    const context: ConversationContext = {
      sessionId,
      namespace: 'legacy'
    };

    return {
      [`memory_search_${sessionId}`]: async (input: string): Promise<string> => {
        const memories = await langmemService.searchMemory(sessionId, input, 3);
        if (memories.length === 0) return 'No relevant memories found.';

        return memories.map((m, i) =>
          `${i + 1}. ${m.content} (relevance: ${m.relevanceScore.toFixed(2)})`
        ).join('\n');
      },

      [`memory_embed_${sessionId}`]: async (input: string): Promise<string> => {
        await langmemService.embedMessage(sessionId, input);
        return 'Message embedded into memory successfully.';
      },

      [`recent_context_${sessionId}`]: async (input: string): Promise<string> => {
        const messages = await langmemService.getRecentMessages(sessionId);
        if (messages.length === 0) return 'No recent messages found.';

        return messages.map((m, i) =>
          `${i + 1}. ${m.content}`
        ).join('\n');
      },

      [`clear_memory_${sessionId}`]: async (input: string): Promise<string> => {
        await langmemService.clearAllMemory(sessionId);
        return 'All memory cleared for this session.';
      },

      [`memory_stats_${sessionId}`]: async (input: string): Promise<string> => {
        const stats = await langmemService.getMemoryStats(context);
        return `Memory Stats: ${stats.totalMemories} total memories, ${Object.keys(stats.typeBreakdown).length} types`;
      }
    };
  }
}

export const createLangMemTools = (config: LangMemToolConfig) => {
  return LangMemTools.createMemoryTools(config);
};

export const createLegacyLangMemTools = (sessionId: string) => {
  return LangMemTools.createLegacyMemoryTools(sessionId);
};