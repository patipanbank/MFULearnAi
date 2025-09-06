import { WebSearchTool } from './WebSearchTool';
import { CalculatorTool } from './CalculatorTool';
import { MemoryTool } from './MemoryTool';
import { RetrievalTool } from './RetrievalTool';

export type ToolFunction = (input: string, sessionId?: string, config?: any) => Promise<string>;

export interface ToolMeta {
  name: string;
  description: string;
  func: ToolFunction;
}

/**
 * ToolRegistry - จัดการ tools ทั้งหมดของระบบ
 * - Static tools (เหมือนเดิม)
 * - Dynamic tools (session-based)
 * - Tool discovery และ management
 */
export class ToolRegistry {
  private staticTools: Map<string, ToolMeta> = new Map();
  
  constructor() {
    this.initializeStaticTools();
    console.log('✅ Tool registry initialized');
  }

  /**
   * Initialize static tools
   */
  private initializeStaticTools(): void {
    // Web search
    const webSearchTool = new WebSearchTool();
    this.staticTools.set('web_search', webSearchTool.getToolMeta());

    // Calculator
    const calculatorTool = new CalculatorTool();
    this.staticTools.set('calculator', calculatorTool.getToolMeta());

    // Current date
    this.staticTools.set('current_date', {
      name: 'current_date',
      description: 'Get the current date and time. Use this when someone asks about the current date, time, or what day it is today.',
      func: async (_input: string, _sessionId?: string, config?: { timezone?: string }) => {
        try {
          const tz = config?.timezone || 'Asia/Bangkok';
          const date = new Date().toLocaleString('th-TH', { timeZone: tz });
          return `Current date/time (${tz}): ${date}`;
        } catch (e) {
          return 'Error getting current date.';
        }
      }
    });

    console.log(`📦 Loaded ${this.staticTools.size} static tools`);
  }

  /**
   * ดึง static tools ทั้งหมด
   */
  public getStaticTools(): { [name: string]: ToolFunction } {
    const tools: { [name: string]: ToolFunction } = {};
    
    for (const [name, meta] of this.staticTools.entries()) {
      tools[name] = meta.func;
    }

    return tools;
  }

  /**
   * สร้าง memory tools สำหรับ session
   */
  public createMemoryTools(sessionId: string): { [name: string]: ToolFunction } {
    const memoryTool = new MemoryTool(sessionId);
    return memoryTool.getTools();
  }

  /**
   * สร้าง retrieval tools สำหรับ collections
   */
  public createRetrievalTools(collectionNames: string[]): { [name: string]: ToolFunction } {
    const tools: { [name: string]: ToolFunction } = {};
    
    for (const collectionName of collectionNames) {
      const retrievalTool = new RetrievalTool(collectionName);
      const toolMeta = retrievalTool.getToolMeta();
      tools[toolMeta.name] = toolMeta.func;
    }

    console.log(`🔍 Created retrieval tools for ${collectionNames.length} collections`);
    return tools;
  }

  /**
   * รวม tools ทั้งหมดสำหรับ session
   */
  public getAllToolsForSession(
    sessionId: string, 
    collectionNames: string[] = []
  ): { [name: string]: ToolFunction } {
    const tools: { [name: string]: ToolFunction } = {};

    // Static tools
    Object.assign(tools, this.getStaticTools());

    // Memory tools
    Object.assign(tools, this.createMemoryTools(sessionId));

    // Retrieval tools
    if (collectionNames.length > 0) {
      Object.assign(tools, this.createRetrievalTools(collectionNames));
    }

    console.log(`🛠️ Assembled ${Object.keys(tools).length} tools for session ${sessionId}`);
    return tools;
  }

  /**
   * ดูรายการ tools ที่มี
   */
  public getAvailableTools(): string[] {
    return Array.from(this.staticTools.keys());
  }

  /**
   * ดูรายละเอียด tool
   */
  public getToolDescription(toolName: string): string | null {
    const tool = this.staticTools.get(toolName);
    return tool ? tool.description : null;
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry();

// Legacy exports for backward compatibility
export const createMemoryTool = (sessionId: string) => toolRegistry.createMemoryTools(sessionId);
export const createRetrievalTools = (collectionNames: string[]) => toolRegistry.createRetrievalTools(collectionNames);