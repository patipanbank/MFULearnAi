import type { ToolFunction } from './ToolRegistry';

export class MemoryTool {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * สร้าง memory tools สำหรับ session นี้
   */
  getTools(): { [name: string]: ToolFunction } {
    return {
      'memory_store': this.createStoreFunction(),
      'memory_search': this.createSearchFunction(),
      'memory_list': this.createListFunction()
    };
  }

  private createStoreFunction(): ToolFunction {
    return async (input: string, sessionId?: string) => {
      try {
        const actualSessionId = sessionId || this.sessionId;
        
        // Parse input (format: "key:value" หรือ JSON)
        let key: string, value: string;
        
        if (input.includes(':') && !input.startsWith('{')) {
          [key, ...value] = input.split(':');
          key = key.trim();
          value = value.join(':').trim();
        } else {
          try {
            const parsed = JSON.parse(input);
            key = parsed.key;
            value = parsed.value;
          } catch {
            return 'Error: Invalid format. Use "key:value" or {"key":"...", "value":"..."}';
          }
        }

        if (!key || !value) {
          return 'Error: Both key and value are required';
        }

        // Store in memory service
        const { memoryService } = await import('../../services/memoryService');
        await memoryService.storeMemory(actualSessionId, key, value);

        return `✅ Stored memory: "${key}" = "${value}"`;
      } catch (error) {
        console.error('Memory store error:', error);
        return `Error storing memory: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    };
  }

  private createSearchFunction(): ToolFunction {
    return async (query: string, sessionId?: string) => {
      try {
        const actualSessionId = sessionId || this.sessionId;
        
        // Search in memory service
        const { memoryService } = await import('../../services/memoryService');
        const results = await memoryService.searchMemories(actualSessionId, query);

        if (results.length === 0) {
          return `No memories found for: "${query}"`;
        }

        const formatted = results.map((result, index) => 
          `${index + 1}. ${result.key}: ${result.value}\n   (Stored: ${result.timestamp.toLocaleString()})`
        ).join('\n\n');

        return `Found ${results.length} memory(ies) for "${query}":\n\n${formatted}`;
      } catch (error) {
        console.error('Memory search error:', error);
        return `Error searching memory: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    };
  }

  private createListFunction(): ToolFunction {
    return async (_input: string, sessionId?: string) => {
      try {
        const actualSessionId = sessionId || this.sessionId;
        
        // List all memories for session
        const { memoryService } = await import('../../services/memoryService');
        const memories = await memoryService.getAllMemories(actualSessionId);

        if (memories.length === 0) {
          return 'No memories stored for this session';
        }

        const formatted = memories.map((memory, index) => 
          `${index + 1}. ${memory.key}: ${memory.value.substring(0, 50)}${memory.value.length > 50 ? '...' : ''}`
        ).join('\n');

        return `All memories for this session (${memories.length} total):\n\n${formatted}`;
      } catch (error) {
        console.error('Memory list error:', error);
        return `Error listing memories: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    };
  }
}