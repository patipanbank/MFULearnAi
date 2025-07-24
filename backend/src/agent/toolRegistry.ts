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
      const results = await webSearch(input);
      if (!results.length) return 'No specific results found.';
      return results.map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\n${r.url}`).join('\n');
    }
  },
  calculator: {
    name: 'calculator',
    description: 'Calculate mathematical expressions. Use this for any mathematical calculations.',
    /**
     * Calculate math expression (TypeScript best practice)
     */
    func: async (input: string) => {
      if (!input || input.trim() === '') return 'No expression provided.';
      return safeEvalMath(input.trim());
    }
  },
  current_date: {
    name: 'current_date',
    description: 'Get the current date and time. Use this when someone asks about the current date, time, or what day it is today.',
    /**
     * Get current date/time (TypeScript best practice)
     */
    func: async (_input: string, _sessionId?: string, config?: { timezone?: string }) => {
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
    /**
     * Search memory (TypeScript best practice)
     */
    func: async (input: string, sessionId?: string) => {
      if (!sessionId) return 'No sessionId provided.';
      const results = await memoryService.searchMemory(sessionId, input);
      if (!results.length) return 'No relevant chat history found.';
      return results.map((r: { role: string; content: string }) => `${r.role}: ${r.content}`).join('\n');
    }
  },
  memory_embed: {
    name: 'memory_embed',
    description: 'Embed new message into chat memory.',
    /**
     * Embed message (TypeScript best practice)
     */
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

/** Web Search Result type */
export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

/** DuckDuckGo API response (บางส่วน) */
interface DuckDuckGoApiResponse {
  Abstract: string;
  RelatedTopics: Array<{ Text: string }>;
}

/** Google Custom Search API response (บางส่วน) */
interface GoogleApiResponse {
  items?: Array<{ title: string; snippet: string; link: string }>;
}

/**
 * ค้นหาข้อมูลจาก DuckDuckGo
 */
async function searchDuckDuckGo(query: string): Promise<WebSearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const resp = await axios.get<DuckDuckGoApiResponse>(url, { timeout: 5000 });
  const results: WebSearchResult[] = [];
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

/**
 * ค้นหาข้อมูลจาก Google Custom Search
 */
async function searchGoogle(query: string): Promise<WebSearchResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) return [];
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}`;
  const resp = await axios.get<GoogleApiResponse>(url, { timeout: 7000 });
  return (resp.data.items || []).slice(0, 3).map(item => ({
    title: item.title,
    snippet: item.snippet,
    url: item.link,
  }));
}

/**
 * Web search tool (DuckDuckGo → Google fallback)
 */
async function webSearch(query: string): Promise<WebSearchResult[]> {
  if (!query || !query.trim()) return [];
  try {
    const ddgResults = await searchDuckDuckGo(query);
    if (ddgResults.length > 0) return ddgResults;
    const googleResults = await searchGoogle(query);
    return googleResults;
  } catch (e) {
    // Logging error
    console.error('Web search error:', e);
    return [];
  }
}

/**
 * Web search tool (TypeScript best practice)
 * - รองรับ DuckDuckGo, Google (fallback)
 * - ปลอดภัย, ขยาย provider ได้ง่าย
 * - รองรับ config: { provider?: 'duckduckgo' | 'google', language?: string }
 */
export const webSearchTool: ToolMeta = {
  name: 'web_search',
  description: 'Search the web for current information. Use this when you need up-to-date information that\'s not in your training data.',
  func: async (input: string, _sessionId?: string, config?: { provider?: 'duckduckgo' | 'google'; language?: string }) => {
    if (!input || input.trim() === '') return 'No query provided.';
    const query = input.trim();
    const provider = config?.provider || 'duckduckgo';
    const language = config?.language || 'en';
    try {
      if (provider === 'duckduckgo') {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&kl=${language}`;
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
      }
      // Google fallback
      if (provider === 'google' || process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) {
        const gUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&hl=${language}`;
        const gResp = await axios.get(gUrl, { timeout: 7000 });
        if (gResp.data && gResp.data.items && gResp.data.items.length > 0) {
          return gResp.data.items.slice(0, 3).map((item: any, i: number) => `${i + 1}. ${item.title}\n${item.snippet}\n${item.link}`).join('\n');
        }
      }
      return 'No specific results found.';
    } catch (e: any) {
      return `Web search error: ${e?.message || 'Unknown error'}`;
    }
  }
};

/**
 * Evaluate mathematical expression safely (no any, no eval)
 */
function safeEvalMath(expr: string): string {
  // Only allow numbers, operators, parentheses, dot, and spaces
  if (!/^[-+*/().\d\s]+$/.test(expr)) return 'Invalid expression';
  try {
    // eslint-disable-next-line no-new-func
    // Use Function constructor for safer math evaluation
    // (Still not 100% safe for untrusted input, but better than eval)
    // For production, use a math parser library
    // @ts-ignore
    // eslint-disable-next-line no-new-func
    return Function(`"use strict";return (${expr})`)().toString();
  } catch {
    return 'Error in calculation';
  }
}

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