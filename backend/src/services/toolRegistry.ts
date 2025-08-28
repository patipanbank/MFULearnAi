import { chromaService } from './chromaService';
import axios from 'axios';
import { bedrockService } from './bedrockService';

export type ToolFunction = (input: string, sessionId?: string, config?: any) => Promise<string>;

/**
 * Unified Tool Registry - จัดการ tools ทั้งหมดรวมที่เดียว
 * - Static tools: calculator, web_search, memory, current_date
 * - Dynamic tools: knowledge base search, session memory
 * - Collection tools: search specific collections
 */

export interface ToolMeta {
  name: string;
  description: string;
  func: ToolFunction;
  category: 'utility' | 'search' | 'memory' | 'knowledge';
  required_params: string[];
}

// สร้าง dynamic tools สำหรับ session
export function createSessionTools(sessionId: string): Record<string, ToolFunction> {
  const sessionTools: Record<string, ToolFunction> = {};
  
  // Memory tools for specific session
  sessionTools[`search_chat_memory_${sessionId}`] = async (input: string) => {
    return await toolRegistry.memory_search(input, sessionId);
  };
  
  sessionTools[`embed_chat_memory_${sessionId}`] = async (input: string) => {
    return await toolRegistry.memory_embed(input, sessionId);
  };
  
  return sessionTools;
}

// สร้าง knowledge tools สำหรับ collections
export function createKnowledgeTools(collectionNames: string[]): Record<string, ToolFunction> {
  const knowledgeTools: Record<string, ToolFunction> = {};
  
  for (const collectionName of collectionNames) {
    knowledgeTools[`search_${collectionName}`] = async (input: string) => {
      try {
        const { chromaService } = await import('./chromaService');
        const { bedrockService } = await import('./bedrockService');
        
        // Generate embedding for search query
        const queryEmbedding = await bedrockService.createTextEmbedding(input);
        if (!queryEmbedding || queryEmbedding.length === 0) {
          return `Search in ${collectionName} is currently unavailable`;
        }
        
        // Search collection
        const results = await chromaService.queryCollection(collectionName, [queryEmbedding], 5);
        
        if (!results?.documents?.length) {
          return `No information found in ${collectionName} for: ${input}`;
        }
        
        const documents = results.documents.flat();
        const metadatas = results.metadatas?.flat() || [];
        
        return documents.slice(0, 3).map((doc: string | null, i: number) => {
          const metadata = metadatas[i] || {};
          const source = metadata?.source || `${collectionName}_doc_${i + 1}`;
          return `${i + 1}. ${doc}\nSource: ${source}`;
        }).join('\n\n');
        
      } catch (error) {
        console.error(`Knowledge search error in ${collectionName}:`, error);
        return `Search in ${collectionName} currently unavailable`;
      }
    };
  }
  
  return knowledgeTools;
}

// Static tool registry (consolidated from toolRegistry.ts)
const staticTools: Record<string, ToolFunction> = {
  calculator: async (input: string) => {
    if (!input || input.trim() === '') return 'No expression provided.';
    try {
      // Only allow safe mathematical characters
      if (!/^[-+*/().\d\s]+$/.test(input)) return 'Invalid mathematical expression';
      
      // Use Function constructor instead of eval for better security
      const result = Function(`"use strict"; return (${input})`)();
      return result.toString();
    } catch (e) {
      return `Calculation error: Please check your mathematical expression`;
    }
  },
  current_date: async (_input: string, _sessionId?: string, config?: any) => {
    try {
      const tz = config?.timezone || 'Asia/Bangkok';
      const date = new Date().toLocaleString('th-TH', { timeZone: tz });
      return `Current date/time (${tz}): ${date}`;
    } catch (e) {
      return 'Error getting current date.';
    }
  },
  memory_search: async (input: string, sessionId?: string, config?: any) => {
    if (!sessionId) return 'Session ID required for memory search';
    if (!input?.trim()) return 'Search query required';
    
    try {
      console.log(`🧠 Searching memory for session ${sessionId}: ${input}`);
      
      const queryEmbedding = await bedrockService.createTextEmbedding(input);
      if (!queryEmbedding || queryEmbedding.length === 0) {
        console.warn('Failed to generate embedding for memory search');
        return 'Memory search temporarily unavailable';
      }

      const k = config?.k || 5;
      const result = await chromaService.queryCollection(`chat_memory_${sessionId}`, [queryEmbedding], k);
      
      if (result?.documents?.length > 0) {
        const documents = result.documents.flat();
        const relevantDocs = documents.slice(0, k);
        console.log(`🧠 Found ${relevantDocs.length} relevant memories`);
        
        return relevantDocs
          .map((doc, i) => `${i + 1}. ${doc}`)
          .join('\n');
      }
      
      return 'No relevant information found in conversation history';
    } catch (e) {
      console.error('Memory search error:', e);
      return 'Memory search currently unavailable';
    }
  },
  memory_embed: async (input: string, sessionId?: string, config?: any) => {
    if (!sessionId) return 'Session ID required for memory embedding';
    if (!input?.trim()) return 'Content required for embedding';
    
    try {
      console.log(`🧠 Embedding memory for session ${sessionId}`);
      
      const embedding = await bedrockService.createTextEmbedding(input);
      if (!embedding || embedding.length === 0) {
        console.warn('Failed to generate embedding for memory');
        return 'Memory embedding temporarily unavailable';
      }

      // Check for duplicates to avoid redundant storage
      const hash = Buffer.from(input.trim()).toString('base64').substring(0, 20);
      
      try {
        const existing = await chromaService.getDocuments(`chat_memory_${sessionId}`);
        if (existing.documents?.some((doc: any) => doc.includes(hash))) {
          return 'Information already stored in memory';
        }
      } catch (e) {
        // If collection doesn't exist, that's fine - we'll create it
      }

      await chromaService.addToCollection(
        `chat_memory_${sessionId}`, 
        [input], 
        [embedding], 
        [{ timestamp: new Date().toISOString(), hash }], 
        [Date.now().toString()]
      );
      
      console.log(`🧠 Successfully embedded memory for session ${sessionId}`);
      return 'Information stored in conversation memory';
    } catch (e) {
      console.error('Memory embedding error:', e);
      return 'Memory embedding currently unavailable';
    }
  },
  web_search: async (input: string, _sessionId?: string, config?: any) => {
    if (!input?.trim()) return 'Search query required';
    
    const query = input.trim();
    console.log(`🔍 Web search: ${query}`);
    
    try {
      // Try Google Custom Search first if configured
      if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) {
        console.log('🔍 Using Google Custom Search');
        const gUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&num=5`;
        
        try {
          const gResp = await axios.get(gUrl, { timeout: 8000 });
          if (gResp.data?.items?.length > 0) {
            const results = gResp.data.items
              .slice(0, 3)
              .map((item: any, i: number) => 
                `${i + 1}. **${item.title}**\n${item.snippet}\nSource: ${item.link}`
              ).join('\n\n');
            console.log(`🔍 Google results: ${results.length} characters`);
            return results;
          }
        } catch (googleError) {
          console.warn('Google Search failed, trying DuckDuckGo');
        }
      }
      
      // Fallback to DuckDuckGo
      console.log('🔍 Using DuckDuckGo');
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const ddgResp = await axios.get(ddgUrl, { timeout: 6000 });
      
      let results = '';
      if (ddgResp.data?.Abstract) {
        results += `**Summary:** ${ddgResp.data.Abstract}\n\n`;
      }
      
      if (ddgResp.data?.RelatedTopics?.length > 0) {
        const topics = ddgResp.data.RelatedTopics
          .slice(0, 3)
          .map((t: any) => t.Text)
          .filter(Boolean);
        
        if (topics.length > 0) {
          results += topics
            .map((topic: string, i: number) => `${i + 1}. ${topic}`)
            .join('\n');
        }
      }
      
      if (results) {
        console.log(`🔍 DuckDuckGo results: ${results.length} characters`);
        return results;
      }
      
      return `No current information found for "${query}". The topic may be too specific or recent.`;
      
    } catch (e) {
      console.error('Web search error:', e);
      return 'Web search is temporarily unavailable. Please try again later.';
    }
  }
};

// รวม tools ทั้งหมดสำหรับ agent
export function getAllTools(sessionId: string, collections: string[] = []): Record<string, ToolFunction> {
  const allTools: Record<string, ToolFunction> = {
    // Static tools
    calculator: staticTools.calculator,
    web_search: staticTools.web_search,
    current_date: staticTools.current_date,
    memory_search: (input: string) => staticTools.memory_search(input, sessionId),
    memory_embed: (input: string) => staticTools.memory_embed(input, sessionId),
    
    // Dynamic session tools
    ...createSessionTools(sessionId),
    
    // Knowledge tools
    ...createKnowledgeTools(collections)
  };
  
  return allTools;
}

// Tool metadata สำหรับ LangChain
export const toolMetadata: Record<string, Omit<ToolMeta, 'func'>> = {
  calculator: {
    name: 'calculator',
    description: 'Perform mathematical calculations. Input: mathematical expression like "2+2" or "sqrt(16)"',
    category: 'utility',
    required_params: ['expression']
  },
  web_search: {
    name: 'web_search',
    description: 'Search the internet for current information. Input: search query',
    category: 'search',
    required_params: ['query']
  },
  current_date: {
    name: 'current_date',
    description: 'Get current date and time. No input required',
    category: 'utility',
    required_params: []
  },
  memory_search: {
    name: 'memory_search',
    description: 'Search conversation memory for relevant context. Input: search terms',
    category: 'memory',
    required_params: ['query']
  },
  memory_embed: {
    name: 'memory_embed',
    description: 'Store information in conversation memory. Input: information to remember',
    category: 'memory',
    required_params: ['content']
  }
};

// Tool registry proxy for backward compatibility
export const toolRegistry: Record<string, ToolFunction> = new Proxy({}, {
  get(_target, prop: string) {
    if (staticTools[prop]) return staticTools[prop];
    return async () => `Tool "${prop}" not found.`;
  }
});