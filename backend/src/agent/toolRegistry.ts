import { toolRegistry as serviceToolRegistry, ToolFunction as ServiceToolFunction } from '../services/toolRegistry';
import { memoryService } from '../services/memoryService';
import axios from 'axios';

export type ToolFunction = (input: string, sessionId?: string, config?: any) => Promise<string>;

export interface ToolMeta {
  name: string;
  description: string;
  func: ToolFunction;
}

/**
 * toolRegistry: รวม tool registry สำหรับ agent (เหมือน backend-legacy/agents/tool_registry.py)
 * - รองรับ web_search, calculator, current_date, memory_search, memory_embed, dynamic tool ฯลฯ
 * - เชื่อมต่อกับ service จริง (ไม่ mock)
 * - มี description/meta
 */
export const toolRegistry: Record<string, ToolMeta> = {
  web_search: {
    name: 'web_search',
    description: 'Search the web for current information. Use this when you need up-to-date information that\'s not in your training data.',
    func: async (input: string) => {
      if (!input || input.trim() === '') return 'No query provided.';
      try {
        // DuckDuckGo API
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(input)}&format=json&no_html=1&skip_disambig=1`;
        const resp = await axios.get(url, { timeout: 5000 });
        if (resp.data && resp.data.Abstract) {
          return `DuckDuckGo: ${resp.data.Abstract}`;
        }
        if (resp.data && resp.data.RelatedTopics && resp.data.RelatedTopics.length > 0) {
          const topics = resp.data.RelatedTopics.slice(0, 3).map((t: any) => t.Text).filter(Boolean);
          if (topics.length > 0) {
            return `DuckDuckGo related: ${topics.join(' | ')}`;
          }
        }
        // Google fallback
        if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) {
          const gUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(input)}`;
          const gResp = await axios.get(gUrl, { timeout: 7000 });
          if (gResp.data && gResp.data.items && gResp.data.items.length > 0) {
            return gResp.data.items.slice(0, 3).map((item: any, i: number) => `${i + 1}. ${item.title}\n${item.snippet}\n${item.link}`).join('\n');
          }
        }
        return 'No specific results found.';
      } catch (e) {
        return `Web search error: ${(e as Error).message}`;
      }
    }
  },
  calculator: {
    name: 'calculator',
    description: 'Calculate mathematical expressions. Use this for any mathematical calculations.',
    func: async (input: string) => {
      if (!input || input.trim() === '') return 'No expression provided.';
      try {
        if (!/^[-+*/().\d\s]+$/.test(input)) return 'Invalid expression';
        // eslint-disable-next-line no-eval
        return eval(input).toString();
      } catch (e) {
        return 'Error in calculation';
      }
    }
  },
  current_date: {
    name: 'current_date',
    description: 'Get the current date and time. Use this when someone asks about the current date, time, or what day it is today.',
    func: async (_input: string, _sessionId?: string, config?: any) => {
      try {
        const tz = config?.timezone || 'Asia/Bangkok';
        const date = new Date().toLocaleString('th-TH', { timeZone: tz });
        return `Current date/time (${tz}): ${date}`;
      } catch (e) {
        return 'Error getting current date.';
      }
    }
  },
  memory_search: {
    name: 'memory_search',
    description: 'Search through chat memory for relevant context.',
    func: async (input: string, sessionId?: string) => {
      if (!sessionId) return 'No sessionId provided.';
      const results = await memoryService.searchMemory(sessionId, input);
      if (!results.length) return 'No relevant chat history found.';
      return results.map((r, i) => `${i + 1}. ${r.role}: ${r.content}`).join('\n');
    }
  },
  memory_embed: {
    name: 'memory_embed',
    description: 'Embed new message into chat memory.',
    func: async (input: string, sessionId?: string) => {
      if (!sessionId) return 'No sessionId provided.';
      await memoryService.embedMessage(sessionId, input);
      return 'Message embedded into memory.';
    }
  },
  // ตัวอย่าง dynamic knowledge base tool (search_collectionName)
  // export function createKnowledgeBaseTool(collectionName: string): ToolMeta {
  //   return {
  //     name: `search_${collectionName}`,
  //     description: `Search and retrieve information from the ${collectionName} knowledge base.`,
  //     func: async (input: string) => {
  //       // TODO: implement vectorstore search for this collection
  //       return `Knowledge base search for ${collectionName} not implemented yet.`;
  //     }
  //   };
  // }
};

// memory tool สำหรับ session (เหมือน legacy)
export function createMemoryTool(sessionId: string) {
  return {
    [`search_chat_memory_${sessionId}`]: {
      name: `search_chat_memory_${sessionId}`,
      description: 'Search through the current chat session history to find relevant context.',
      func: (input: string) => toolRegistry.memory_search.func(input, sessionId)
    },
    [`embed_chat_memory_${sessionId}`]: {
      name: `embed_chat_memory_${sessionId}`,
      description: 'Embed new message into chat memory for this session.',
      func: (input: string) => toolRegistry.memory_embed.func(input, sessionId)
    },
    [`recent_context_${sessionId}`]: {
      name: `recent_context_${sessionId}`,
      description: 'Get recent context from memory (last 10 messages in Redis).',
      func: async () => {
        const recent = await memoryService.getRecentMessages(sessionId);
        if (!recent.length) return 'No recent context found in memory.';
        return recent.map((msg, i) => `${i + 1}. ${msg.role}: ${msg.content}`).join('\n');
      }
    },
    [`full_context_${sessionId}`]: {
      name: `full_context_${sessionId}`,
      description: 'Get full conversation context from memory (vectorstore).',
      func: async () => {
        const all = await memoryService.getAllMessages(sessionId);
        if (!all.length) return 'No context found in memory.';
        return all.map((msg, i) => `${i + 1}. ${msg.role}: ${msg.content}`).join('\n');
      }
    },
    [`clear_memory_${sessionId}`]: {
      name: `clear_memory_${sessionId}`,
      description: 'Clear all chat memory for this session.',
      func: async () => {
        await memoryService.clearRecentMessages(sessionId);
        await memoryService.clearLongTermMemory(sessionId);
        return 'Memory cleared.';
      }
    },
    [`memory_stats_${sessionId}`]: {
      name: `memory_stats_${sessionId}`,
      description: 'Get memory usage statistics for this session.',
      func: async () => {
        // (mocked: real stats would require aggregation)
        return 'Memory stats: (not implemented in this version)';
      }
    }
  };
}

// Utility functions
export async function addChatMemory(sessionId: string, messages: { role: string; content: string; id?: string; timestamp?: string }[]) {
  for (const msg of messages) {
    await toolRegistry.memory_embed.func(msg.content, sessionId);
  }
}

export async function clearChatMemory(sessionId: string) {
  await memoryService.clearRecentMessages(sessionId);
  await memoryService.clearLongTermMemory(sessionId);
}

export async function getMemoryStats(sessionId: string) {
  // (mocked: real stats would require aggregation)
  return 'Memory stats: (not implemented in this version)';
} 