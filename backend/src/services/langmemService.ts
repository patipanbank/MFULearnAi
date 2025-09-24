import { spawn } from 'child_process';
import { promisify } from 'util';

export interface LangMemMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface LangMemSearchResult {
  content: string;
  relevanceScore: number;
  metadata?: Record<string, any>;
}

export interface LangMemConfig {
  apiKey?: string;
  provider?: 'anthropic' | 'openai';
  model?: string;
}

export class LangMemService {
  private config: LangMemConfig;
  private pythonPath: string;

  constructor(config: LangMemConfig = {}) {
    this.config = {
      provider: 'anthropic',
      model: 'claude-3-sonnet-20240229',
      ...config
    };
    this.pythonPath = process.env.PYTHON_PATH || 'python';
  }

  /**
   * Add message to LangMem memory
   */
  async addMessage(sessionId: string, message: LangMemMessage): Promise<void> {
    try {
      const pythonScript = `
import sys
import json
import os
from langmem import create_manage_memory_tool

# Set API key
if "${this.config.apiKey}" and "${this.config.apiKey}" != "undefined":
    os.environ["ANTHROPIC_API_KEY"] = "${this.config.apiKey}"

# Create memory tool with namespace
memory_tool = create_manage_memory_tool("mfu_chatbot")

# Prepare message data
message_data = {
    "user_id": "${sessionId}",
    "content": """${message.content.replace(/"/g, '\\"')}""",
    "role": "${message.role}",
    "timestamp": "${message.timestamp}"
}

# Store memory
try:
    result = memory_tool.invoke({
        "command": "store",
        "user_id": "${sessionId}",
        "memory": f"[{message_data['role']}] {message_data['content']}"
    })
    print(json.dumps({"success": True, "result": str(result)}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

      const result = await this.runPythonScript(pythonScript);
      console.log(`🧠 LangMem: Added message for session ${sessionId}`);

    } catch (error) {
      console.error(`❌ LangMem: Error adding message: ${error}`);
      throw error;
    }
  }

  /**
   * Search memories using LangMem
   */
  async searchMemory(sessionId: string, query: string, limit: number = 5): Promise<LangMemSearchResult[]> {
    try {
      const pythonScript = `
import sys
import json
import os
from langmem import create_search_memory_tool

# Set API key
if "${this.config.apiKey}" and "${this.config.apiKey}" != "undefined":
    os.environ["ANTHROPIC_API_KEY"] = "${this.config.apiKey}"

# Create search tool with namespace
search_tool = create_search_memory_tool("mfu_chatbot")

try:
    result = search_tool.invoke({
        "query": "${query.replace(/"/g, '\\"')}",
        "user_id": "${sessionId}",
        "limit": ${limit}
    })
    print(json.dumps({"success": True, "results": str(result)}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

      const result = await this.runPythonScript(pythonScript);
      const data = JSON.parse(result);

      if (!data.success) {
        console.error(`❌ LangMem search error: ${data.error}`);
        return [];
      }

      // Transform LangMem results to our format
      const memories = data.results || [];
      return memories.map((memory: any) => ({
        content: memory.content || memory.memory || '',
        relevanceScore: memory.score || memory.relevance || 0.8,
        metadata: memory.metadata || {}
      }));

    } catch (error) {
      console.error(`❌ LangMem: Error searching memory: ${error}`);
      return [];
    }
  }

  /**
   * Get conversation context for a session
   */
  async getConversationContext(sessionId: string, query?: string): Promise<LangMemMessage[]> {
    try {
      let messages: LangMemMessage[] = [];

      if (query) {
        // Search for relevant memories
        const searchResults = await this.searchMemory(sessionId, query, 10);

        messages = searchResults.map(result => ({
          role: 'assistant' as const,
          content: result.content,
          timestamp: new Date().toISOString(),
          metadata: {
            ...result.metadata,
            relevanceScore: result.relevanceScore,
            source: 'langmem_search'
          }
        }));
      } else {
        // Get recent memories without specific query
        const searchResults = await this.searchMemory(sessionId, 'recent conversation', 5);

        messages = searchResults.map(result => ({
          role: 'assistant' as const,
          content: result.content,
          timestamp: new Date().toISOString(),
          metadata: {
            ...result.metadata,
            relevanceScore: result.relevanceScore,
            source: 'langmem_recent'
          }
        }));
      }

      return messages;

    } catch (error) {
      console.error(`❌ LangMem: Error getting conversation context: ${error}`);
      return [];
    }
  }

  /**
   * Clear all memories for a session
   */
  async clearMemory(sessionId: string): Promise<void> {
    try {
      const pythonScript = `
import sys
import json
import os
from langmem import create_manage_memory_tool

# Set API key
if "${this.config.apiKey}" and "${this.config.apiKey}" != "undefined":
    os.environ["ANTHROPIC_API_KEY"] = "${this.config.apiKey}"

# Create memory tool
memory_tool = create_manage_memory_tool()

try:
    result = memory_tool.invoke({
        "command": "clear",
        "user_id": "${sessionId}"
    })
    print(json.dumps({"success": True, "result": result}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

      await this.runPythonScript(pythonScript);
      console.log(`🧹 LangMem: Cleared memory for session ${sessionId}`);

    } catch (error) {
      console.error(`❌ LangMem: Error clearing memory: ${error}`);
      throw error;
    }
  }

  /**
   * Get memory statistics for a session
   */
  async getMemoryStats(sessionId: string): Promise<any> {
    try {
      // LangMem doesn't have direct stats API, so we'll search and count
      const recentMemories = await this.searchMemory(sessionId, 'conversation history', 50);

      return {
        sessionId,
        memoryCount: recentMemories.length,
        memoryType: 'langmem',
        provider: this.config.provider,
        model: this.config.model,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ LangMem: Error getting memory stats: ${error}`);
      return {
        sessionId,
        memoryCount: 0,
        error: 'Stats unavailable',
        memoryType: 'langmem'
      };
    }
  }

  /**
   * Legacy compatibility methods
   */
  async addRecentMessage(sessionId: string, message: any): Promise<void> {
    const langMemMessage: LangMemMessage = {
      role: message.role || 'user',
      content: message.content || '',
      timestamp: message.timestamp || new Date().toISOString(),
      metadata: message.metadata
    };
    await this.addMessage(sessionId, langMemMessage);
  }

  async getRecentMessages(sessionId: string): Promise<any[]> {
    const messages = await this.getConversationContext(sessionId);
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      ...msg.metadata
    }));
  }

  async embedMessage(sessionId: string, content: string): Promise<void> {
    await this.addMessage(sessionId, {
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    });
  }

  async setupHybridMemory(sessionId: string, messages: any[]): Promise<void> {
    console.log(`🧠 LangMem: Setting up memory for session ${sessionId} with ${messages.length} messages`);

    // Add all messages to LangMem
    for (const msg of messages) {
      await this.addRecentMessage(sessionId, msg);
    }

    console.log(`💾 LangMem: Memory initialized with ${messages.length} messages`);
  }

  /**
   * Run Python script and return output
   */
  private async runPythonScript(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(this.pythonPath, ['-c', script]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        } else {
          resolve(stdout.trim());
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }

  /**
   * Create LangMem tools for agent use
   */
  async createMemoryTools(sessionId: string) {
    const manageMemoryTool = {
      name: 'manage_memory',
      description: 'Store and manage conversation memories using LangMem',
      function: async (args: { command: string; memory?: string }) => {
        if (args.command === 'store' && args.memory) {
          await this.addMessage(sessionId, {
            role: 'assistant',
            content: args.memory,
            timestamp: new Date().toISOString()
          });
          return { success: true, message: 'Memory stored successfully' };
        }
        return { success: false, message: 'Invalid command or missing memory content' };
      }
    };

    const searchMemoryTool = {
      name: 'search_memory',
      description: 'Search conversation memories using LangMem',
      function: async (args: { query: string; limit?: number }) => {
        const results = await this.searchMemory(sessionId, args.query, args.limit || 5);
        return {
          success: true,
          results: results.map(r => ({
            content: r.content,
            relevance: r.relevanceScore
          }))
        };
      }
    };

    return { manageMemoryTool, searchMemoryTool };
  }
}

// Export singleton instance
export const langMemService = new LangMemService({
  apiKey: process.env.ANTHROPIC_API_KEY,
  provider: 'anthropic'
});