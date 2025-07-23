import { chromaService } from './chromaService';
import axios from 'axios';
import { bedrockService } from './bedrockService'; // เพิ่ม import นี้

export type ToolFunction = (input: string, sessionId: string, config?: any) => Promise<string>;

// Static tool registry (default tools)
const staticTools: Record<string, ToolFunction> = {
  calculator: async (input: string) => {
    if (!input || input.trim() === '') return 'No expression provided.';
    try {
      if (!/^[-+*/().\d\s]+$/.test(input)) return 'Invalid expression';
      // eslint-disable-next-line no-eval
      return eval(input).toString();
    } catch (e) {
      return 'Error in calculation';
    }
  },
  current_date: async (_input: string, _sessionId: string, config?: any) => {
    try {
      const tz = config?.timezone || 'Asia/Bangkok';
      const date = new Date().toLocaleString('th-TH', { timeZone: tz });
      return `Current date/time (${tz}): ${date}`;
    } catch (e) {
      return 'Error getting current date.';
    }
  },
  memory_search: async (input: string, sessionId: string, config?: any) => {
    try {
      // Generate embedding for the query text
      const queryEmbedding = await bedrockService.createTextEmbedding(input); // ใช้ bedrockService
      if (!queryEmbedding || queryEmbedding.length === 0) {
        return 'Failed to generate embedding for query.';
      }

      const k = config?.k || 3;
      const result = await chromaService.queryCollection(`chat_memory_${sessionId}`, [queryEmbedding], k); // ส่ง queryEmbeddings
      if (result && result.documents && result.documents.length > 0) {
        const seen = new Set();
        const docs = result.documents.filter((doc: any) => {
          if (seen.has(doc.id)) return false;
          seen.add(doc.id);
          return true;
        });
        return docs.map((doc: any, i: number) => `${i + 1}. ${doc.document}`).join('\n');
      }
      return 'No relevant memory found.';
    } catch (e) {
      return `Memory search error: ${(e as Error).message}`;
    }
  },
  memory_embed: async (input: string, sessionId: string, config?: any) => {
    try {
      if (!input || input.trim() === '') return 'No content to embed.';
      
      // Generate embedding for the input text
      const embedding = await bedrockService.createTextEmbedding(input); // ใช้ bedrockService
      if (!embedding || embedding.length === 0) {
        return 'Failed to generate embedding for content.';
      }

      const hash = Buffer.from(input).toString('base64');
      const existing = await chromaService.getDocuments(`chat_memory_${sessionId}`);
      if (existing.documents.some((doc: any) => Buffer.from(doc.document).toString('base64') === hash)) {
        return 'Already embedded.';
      }
      await chromaService.addToCollection(`chat_memory_${sessionId}`, [input], [embedding], [{}], [Date.now().toString()]); // ส่ง embedding
      return 'Memory embedded.';
    } catch (e) {
      return `Memory embed error: ${(e as Error).message}`;
    }
  },
  web_search: async (input: string, _sessionId: string, config?: any) => {
    if (!input || input.trim() === '') return 'No query provided.';
    try {
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
      return 'No specific results found.';
    } catch (e) {
      return `Web search error: ${(e as Error).message}`;
    }
  }
};

// Dynamic tool registry (mock, ไม่ใช้ DB จริง)
let dynamicTools: Record<string, ToolFunction> = {};
// export async function reloadDynamicTools() {
//   // โหลด tool จาก database/config (ToolModel)
//   try {
//     const tools = await ToolModel.find({ enabled: true });
//     const reg: Record<string, ToolFunction> = {};
//     for (const tool of tools) {
//       // tool.type, tool.config, tool.endpoint, tool.code, ...
//       if (tool.type === 'http') {
//         reg[tool.name] = async (input: string, sessionId: string, config?: any) => {
//           try {
//             const resp = await axios.post(tool.endpoint, { input, sessionId, ...config });
//             return resp.data?.result || JSON.stringify(resp.data);
//           } catch (e) {
//             return `Dynamic tool error: ${(e as Error).message}`;
//           }
//         };
//       } else if (tool.type === 'code') {
//         reg[tool.name] = async (input: string, sessionId: string, config?: any) => {
//           try {
//             // eslint-disable-next-line no-new-func
//             const fn = new Function('input', 'sessionId', 'config', tool.code);
//             return await fn(input, sessionId, config);
//           } catch (e) {
//             return `Dynamic tool error: ${(e as Error).message}`;
//           }
//         };
//       }
//     }
//     dynamicTools = reg;
//     console.log(`[ToolRegistry] Reloaded dynamic tools: ${Object.keys(dynamicTools).join(', ')}`);
//   } catch (e) {
//     console.error('[ToolRegistry] Failed to reload dynamic tools:', e);
//   }
// }
// setInterval(reloadDynamicTools, 60000);

export const toolRegistry: Record<string, ToolFunction> = new Proxy({}, {
  get(_target, prop: string) {
    if (dynamicTools[prop]) return dynamicTools[prop];
    if (staticTools[prop]) return staticTools[prop];
    return async () => `Tool "${prop}" not found.`;
  }
}); 