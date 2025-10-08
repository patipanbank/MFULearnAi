/**
 * 🔧 Unified Tool Registry System
 *
 * ระบบจัดการ tools แบบรวมศูนย์ที่รอบคอบและมีประสิทธิภาพ
 * - Centralized tool management
 * - Dynamic tool loading with validation
 * - Tool versioning and dependency management
 * - Consistent interface across backend and frontend
 * - Memory management และ cleanup
 */

import { ragClient, storageClient, bedrockClient } from './httpClients';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// ================== TOOL INTERFACES ==================

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  category: ToolCategory;
  type: ToolType;
  enabled: boolean;
  dependencies?: string[];
  config: Record<string, any>;
  metadata: ToolMetadata;
}

export interface ToolMetadata {
  author?: string;
  tags: string[];
  documentation?: string;
  examples?: ToolExample[];
  performance?: ToolPerformance;
  lastUpdated: Date;
  usage_count: number;
}

export interface ToolExample {
  input: string;
  expectedOutput: string;
  description: string;
}

export interface ToolPerformance {
  averageResponseTime: number;
  successRate: number;
  lastBenchmark: Date;
}

export enum ToolCategory {
  CORE = 'core',
  SEARCH = 'search',
  CALCULATION = 'calculation',
  MEMORY = 'memory',
  RETRIEVAL = 'retrieval',
  INTEGRATION = 'integration',
  UTILITY = 'utility',
  CUSTOM = 'custom'
}

export enum ToolType {
  STATIC = 'static',
  DYNAMIC = 'dynamic',
  SESSION_SPECIFIC = 'session_specific',
  COLLECTION_SPECIFIC = 'collection_specific'
}

export interface ToolExecutionContext {
  sessionId?: string;
  userId?: string;
  agentId?: string;
  collectionNames?: string[];
  config?: Record<string, any>;
}

export interface ToolExecutionResult {
  success: boolean;
  result: string;
  error?: string;
  executionTime: number;
  tokensUsed?: number;
  metadata?: Record<string, any>;
}

export type ToolFunction = (
  input: string,
  context: ToolExecutionContext
) => Promise<ToolExecutionResult>;

// ================== CORE TOOL REGISTRY ==================

export class UnifiedToolRegistry {
  private static instance: UnifiedToolRegistry;
  private tools: Map<string, ToolConfig> = new Map();
  private toolFunctions: Map<string, ToolFunction> = new Map();
  private activeTools: Map<string, Set<string>> = new Map(); // sessionId -> tool names

  private constructor() {
    this.initializeCorTools();
  }

  public static getInstance(): UnifiedToolRegistry {
    if (!UnifiedToolRegistry.instance) {
      UnifiedToolRegistry.instance = new UnifiedToolRegistry();
    }
    return UnifiedToolRegistry.instance;
  }

  // ================== TOOL MANAGEMENT ==================

  /**
   * Register a new tool
   */
  public registerTool(config: ToolConfig, func: ToolFunction): void {
    // Validate dependencies
    if (config.dependencies) {
      for (const dep of config.dependencies) {
        if (!this.tools.has(dep)) {
          throw new Error(`Tool dependency "${dep}" not found for tool "${config.id}"`);
        }
      }
    }

    this.tools.set(config.id, config);
    this.toolFunctions.set(config.id, func);

    console.log(`🔧 Registered tool: ${config.id} (${config.version})`);
  }

  /**
   * Get available tools for specific context
   */
  public getAvailableTools(context: ToolExecutionContext): ToolConfig[] {
    const availableTools: ToolConfig[] = [];

    for (const [toolId, config] of this.tools.entries()) {
      if (!config.enabled) continue;

      // Check tool type compatibility
      switch (config.type) {
        case ToolType.STATIC:
          availableTools.push(config);
          break;

        case ToolType.SESSION_SPECIFIC:
          if (context.sessionId) {
            availableTools.push(config);
          }
          break;

        case ToolType.COLLECTION_SPECIFIC:
          if (context.collectionNames && context.collectionNames.length > 0) {
            availableTools.push(config);
          }
          break;

        case ToolType.DYNAMIC:
          // Dynamic tools are always available but may behave differently
          availableTools.push(config);
          break;
      }
    }

    return availableTools;
  }

  /**
   * Execute tool with full context and monitoring
   */
  public async executeTool(
    toolId: string,
    input: string,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const config = this.tools.get(toolId);
      const func = this.toolFunctions.get(toolId);

      if (!config || !func) {
        return {
          success: false,
          result: '',
          error: `Tool "${toolId}" not found`,
          executionTime: Date.now() - startTime
        };
      }

      if (!config.enabled) {
        return {
          success: false,
          result: '',
          error: `Tool "${toolId}" is disabled`,
          executionTime: Date.now() - startTime
        };
      }

      // Track active tool usage
      if (context.sessionId) {
        if (!this.activeTools.has(context.sessionId)) {
          this.activeTools.set(context.sessionId, new Set());
        }
        this.activeTools.get(context.sessionId)!.add(toolId);
      }

      // Execute tool
      const result = await func(input, context);

      // Update usage statistics
      config.metadata.usage_count++;

      // Update performance metrics
      const executionTime = Date.now() - startTime;
      if (config.metadata.performance) {
        const perf = config.metadata.performance;
        perf.averageResponseTime = (perf.averageResponseTime + executionTime) / 2;
        perf.successRate = result.success ?
          (perf.successRate * 0.9 + 0.1) :
          (perf.successRate * 0.9);
        perf.lastBenchmark = new Date();
      }

      return {
        ...result,
        executionTime
      };

    } catch (error) {
      return {
        success: false,
        result: '',
        error: (error as Error).message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Create session-specific tools
   */
  public createSessionTools(sessionId: string): ToolConfig[] {
    const sessionTools: ToolConfig[] = [];

    // Memory tools for specific session
    const memoryToolConfigs = [
      {
        id: `search_memory_${sessionId}`,
        name: 'Search Chat Memory',
        description: 'Search through conversation history for this session',
        version: '1.0.0',
        category: ToolCategory.MEMORY,
        type: ToolType.SESSION_SPECIFIC,
        enabled: true,
        config: { sessionId },
        metadata: {
          tags: ['memory', 'search', 'session'],
          lastUpdated: new Date(),
          usage_count: 0
        }
      },
      {
        id: `embed_memory_${sessionId}`,
        name: 'Embed to Memory',
        description: 'Store information in conversation memory',
        version: '1.0.0',
        category: ToolCategory.MEMORY,
        type: ToolType.SESSION_SPECIFIC,
        enabled: true,
        config: { sessionId },
        metadata: {
          tags: ['memory', 'embed', 'session'],
          lastUpdated: new Date(),
          usage_count: 0
        }
      },
      {
        id: `get_recent_context_${sessionId}`,
        name: 'Get Recent Context',
        description: 'Get recent conversation context',
        version: '1.0.0',
        category: ToolCategory.MEMORY,
        type: ToolType.SESSION_SPECIFIC,
        enabled: true,
        config: { sessionId },
        metadata: {
          tags: ['memory', 'context', 'session'],
          lastUpdated: new Date(),
          usage_count: 0
        }
      }
    ];

    for (const config of memoryToolConfigs) {
      this.registerTool(config as ToolConfig, this.createMemoryToolFunction(config.id, sessionId));
      sessionTools.push(config as ToolConfig);
    }

    return sessionTools;
  }

  /**
   * Create collection-specific search tools
   */
  public createCollectionTools(collectionNames: string[]): ToolConfig[] {
    const collectionTools: ToolConfig[] = [];

    for (const collectionName of collectionNames) {
      const toolConfig: ToolConfig = {
        id: `search_${collectionName}`,
        name: `Search ${collectionName}`,
        description: `Search and retrieve information from the ${collectionName} knowledge base`,
        version: '1.0.0',
        category: ToolCategory.RETRIEVAL,
        type: ToolType.COLLECTION_SPECIFIC,
        enabled: true,
        config: { collectionName },
        metadata: {
          tags: ['search', 'knowledge', 'collection'],
          lastUpdated: new Date(),
          usage_count: 0
        }
      };

      this.registerTool(toolConfig, this.createCollectionSearchFunction(collectionName));
      collectionTools.push(toolConfig);
    }

    return collectionTools;
  }

  /**
   * Clean up session-specific tools
   */
  public cleanupSessionTools(sessionId: string): void {
    const keysToDelete: string[] = [];

    for (const [toolId, config] of this.tools.entries()) {
      if (config.type === ToolType.SESSION_SPECIFIC &&
          config.config.sessionId === sessionId) {
        keysToDelete.push(toolId);
      }
    }

    for (const toolId of keysToDelete) {
      this.tools.delete(toolId);
      this.toolFunctions.delete(toolId);
    }

    this.activeTools.delete(sessionId);
    console.log(`🧹 Cleaned up ${keysToDelete.length} session tools for ${sessionId}`);
  }

  /**
   * Get tool statistics
   */
  public getToolStatistics(): Record<string, any> {
    const stats = {
      totalTools: this.tools.size,
      enabledTools: 0,
      toolsByCategory: {} as Record<string, number>,
      toolsByType: {} as Record<string, number>,
      activeSessions: this.activeTools.size,
      totalUsage: 0
    };

    for (const config of this.tools.values()) {
      if (config.enabled) stats.enabledTools++;

      stats.toolsByCategory[config.category] = (stats.toolsByCategory[config.category] || 0) + 1;
      stats.toolsByType[config.type] = (stats.toolsByType[config.type] || 0) + 1;
      stats.totalUsage += config.metadata.usage_count;
    }

    return stats;
  }

  // ================== CORE TOOLS INITIALIZATION ==================

  private initializeCorTools(): void {
    // Web Search Tool
    this.registerTool({
      id: 'web_search',
      name: 'Web Search',
      description: 'Search the web for current information using Google Search API or DuckDuckGo fallback',
      version: '2.0.0',
      category: ToolCategory.SEARCH,
      type: ToolType.STATIC,
      enabled: true,
      config: {
        providers: ['google', 'duckduckgo'],
        timeout: 7000,
        maxResults: 3
      },
      metadata: {
        tags: ['web', 'search', 'information'],
        documentation: 'Search the internet for up-to-date information on any topic',
        examples: [
          {
            input: 'latest news about AI technology',
            expectedOutput: 'Recent news articles about AI technology developments',
            description: 'Get current news and updates'
          }
        ],
        performance: {
          averageResponseTime: 2000,
          successRate: 0.95,
          lastBenchmark: new Date()
        },
        lastUpdated: new Date(),
        usage_count: 0
      }
    }, this.createWebSearchFunction());

    // Calculator Tool
    this.registerTool({
      id: 'calculator',
      name: 'Calculator',
      description: 'Perform mathematical calculations and expressions safely',
      version: '2.0.0',
      category: ToolCategory.CALCULATION,
      type: ToolType.STATIC,
      enabled: true,
      config: {
        allowedOperations: ['+', '-', '*', '/', '(', ')', '.'],
        maxInputLength: 200
      },
      metadata: {
        tags: ['math', 'calculation', 'arithmetic'],
        documentation: 'Evaluate mathematical expressions safely',
        examples: [
          {
            input: '2 + 2 * 3',
            expectedOutput: '8',
            description: 'Basic arithmetic with order of operations'
          }
        ],
        performance: {
          averageResponseTime: 10,
          successRate: 0.99,
          lastBenchmark: new Date()
        },
        lastUpdated: new Date(),
        usage_count: 0
      }
    }, this.createCalculatorFunction());

    // Current Date Tool
    this.registerTool({
      id: 'current_date',
      name: 'Current Date',
      description: 'Get current date and time with timezone support',
      version: '2.0.0',
      category: ToolCategory.UTILITY,
      type: ToolType.STATIC,
      enabled: true,
      config: {
        defaultTimezone: 'Asia/Bangkok',
        supportedTimezones: ['Asia/Bangkok', 'UTC', 'America/New_York', 'Europe/London']
      },
      metadata: {
        tags: ['date', 'time', 'utility'],
        documentation: 'Get current date and time in specified timezone',
        examples: [
          {
            input: '',
            expectedOutput: 'Current date/time (Asia/Bangkok): 2024-01-01 12:00:00',
            description: 'Get current date and time'
          }
        ],
        performance: {
          averageResponseTime: 5,
          successRate: 1.0,
          lastBenchmark: new Date()
        },
        lastUpdated: new Date(),
        usage_count: 0
      }
    }, this.createCurrentDateFunction());

    console.log('🔧 Initialized core tools');
  }

  // ================== TOOL FUNCTION CREATORS ==================

  private createWebSearchFunction(): ToolFunction {
    return async (input: string, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
      if (!input || input.trim() === '') {
        return {
          success: false,
          result: '',
          error: 'No search query provided'
        } as ToolExecutionResult;
      }

      try {
        console.log(`🔍 Web search query: ${input}`);

        // Try Google Search API first
        if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) {
          console.log(`🔍 Using Google Search API`);
          const gUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(input)}&num=3`;
          const gResp = await axios.get(gUrl, { timeout: 7000 });

          if (gResp.data && gResp.data.items && gResp.data.items.length > 0) {
            const results = gResp.data.items.map((item: any, i: number) =>
              `${i + 1}. ${item.title}\n${item.snippet}\n${item.link}`
            ).join('\n\n');

            return {
              success: true,
              result: results,
              executionTime: 0,
              metadata: { provider: 'google', resultCount: gResp.data.items.length }
            } as ToolExecutionResult;
          }
        }

        // Fallback to DuckDuckGo
        console.log(`🔍 Using DuckDuckGo API`);
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(input)}&format=json&no_html=1&skip_disambig=1`;
        const resp = await axios.get(url, { timeout: 5000 });

        if (resp.data && resp.data.Abstract) {
          return {
            success: true,
            result: `DuckDuckGo: ${resp.data.Abstract}`,
            executionTime: 0,
            metadata: { provider: 'duckduckgo', hasAbstract: true }
          } as ToolExecutionResult;
        }

        if (resp.data && resp.data.RelatedTopics && resp.data.RelatedTopics.length > 0) {
          const topics = resp.data.RelatedTopics.slice(0, 3).map((t: any) => t.Text).filter(Boolean);
          if (topics.length > 0) {
            return {
              success: true,
              result: `DuckDuckGo related: ${topics.join(' | ')}`,
              executionTime: 0,
              metadata: { provider: 'duckduckgo', hasRelatedTopics: true }
            } as ToolExecutionResult;
          }
        }

        return {
          success: false,
          result: '',
          error: 'No specific results found from any search provider'
        } as ToolExecutionResult;

      } catch (error) {
        return {
          success: false,
          result: '',
          error: `Web search error: ${(error as Error).message}`
        } as ToolExecutionResult;
      }
    };
  }

  private createCalculatorFunction(): ToolFunction {
    return async (input: string, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
      if (!input || input.trim() === '') {
        return {
          success: false,
          result: '',
          error: 'No mathematical expression provided'
        } as ToolExecutionResult;
      }

      try {
        // Validate expression
        if (!/^[-+*/().\d\s]+$/.test(input)) {
          return {
            success: false,
            result: '',
            error: 'Invalid mathematical expression - only numbers and basic operators allowed'
          } as ToolExecutionResult;
        }

        // Safe evaluation using Function constructor
        const result = Function(`"use strict"; return (${input})`)();

        return {
          success: true,
          result: result.toString(),
          executionTime: 0,
          metadata: { expression: input, resultType: typeof result }
        } as ToolExecutionResult;

      } catch (error) {
        return {
          success: false,
          result: '',
          error: `Calculation error: ${(error as Error).message}`
        } as ToolExecutionResult;
      }
    };
  }

  private createCurrentDateFunction(): ToolFunction {
    return async (input: string, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
      try {
        const timezone = context.config?.timezone || 'Asia/Bangkok';
        const date = new Date().toLocaleString('th-TH', { timeZone: timezone });

        return {
          success: true,
          result: `Current date/time (${timezone}): ${date}`,
          executionTime: 0,
          metadata: { timezone, timestamp: new Date().toISOString() }
        } as ToolExecutionResult;

      } catch (error) {
        return {
          success: false,
          result: '',
          error: `Error getting current date: ${(error as Error).message}`
        } as ToolExecutionResult;
      }
    };
  }

  private createMemoryToolFunction(toolId: string, sessionId: string): ToolFunction {
    return async (input: string, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
      try {
        if (toolId.includes('search_memory')) {
          const results = await ragClient.searchMemory(sessionId, input);
          if (!results.length) {
            return {
              success: true,
              result: 'No relevant chat history found',
              executionTime: 0,
              metadata: { searchQuery: input, resultCount: 0 }
            } as ToolExecutionResult;
          }

          const formattedResults = results.map((r: any, i: number) =>
            `${i + 1}. ${r.role}: ${r.content}`
          ).join('\n');

          return {
            success: true,
            result: formattedResults,
            executionTime: 0,
            metadata: { searchQuery: input, resultCount: results.length }
          } as ToolExecutionResult;

        } else if (toolId.includes('embed_memory')) {
          await ragClient.embedMessage(sessionId, input);
          return {
            success: true,
            result: 'Message embedded into memory successfully',
            executionTime: 0,
            metadata: { embeddedContent: input }
          } as ToolExecutionResult;

        } else if (toolId.includes('get_recent_context')) {
          const recent = await ragClient.searchMemory(sessionId, '', 10);
          if (!recent.length) {
            return {
              success: true,
              result: 'No recent context found',
              executionTime: 0,
              metadata: { resultCount: 0 }
            } as ToolExecutionResult;
          }

          const formattedRecent = recent.map((msg: any, i: number) =>
            `${i + 1}. ${msg.role}: ${msg.content}`
          ).join('\n');

          return {
            success: true,
            result: formattedRecent,
            executionTime: 0,
            metadata: { resultCount: recent.length }
          } as ToolExecutionResult;
        }

        return {
          success: false,
          result: '',
          error: 'Unknown memory tool operation'
        } as ToolExecutionResult;

      } catch (error) {
        return {
          success: false,
          result: '',
          error: `Memory tool error: ${(error as Error).message}`
        } as ToolExecutionResult;
      }
    };
  }

  private createCollectionSearchFunction(collectionName: string): ToolFunction {
    return async (input: string, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
      try {
        // Search collection via RAG service
        const results = await ragClient.searchCollection(collectionName, input, 5);

        if (!results || !results.documents || results.documents.length === 0) {
          return {
            success: true,
            result: `No information found in ${collectionName} for: ${input}`,
            executionTime: 0,
            metadata: { collectionName, searchQuery: input, resultCount: 0 }
          } as ToolExecutionResult;
        }

        // Format results
        const documents = results.documents.flat();
        const metadatas = results.metadatas ? results.metadatas.flat() : [];

        const formattedResults = documents.map((doc: string | null, i: number) => {
          const metadata = metadatas[i] || {};
          const sourceName = metadata?.source || `${collectionName}_document_${i + 1}`;
          const sourceType = metadata?.source_type || 'unknown';
          const uploadedBy = metadata?.uploadedBy;

          let sourceInfo = `Source: ${sourceName}`;
          if (sourceType && sourceType !== 'unknown') {
            sourceInfo += ` (${sourceType})`;
          }
          if (uploadedBy && uploadedBy !== 'system') {
            sourceInfo += ` [Uploaded by: ${uploadedBy}]`;
          }

          return `${i + 1}. ${doc || 'No content'}\n${sourceInfo}`;
        }).join('\n\n');

        return {
          success: true,
          result: formattedResults,
          executionTime: 0,
          metadata: {
            collectionName,
            searchQuery: input,
            resultCount: documents.length
          }
        } as ToolExecutionResult;

      } catch (error) {
        return {
          success: false,
          result: '',
          error: `Collection search error: ${(error as Error).message}`
        } as ToolExecutionResult;
      }
    };
  }
}

// Export singleton instance
export const unifiedToolRegistry = UnifiedToolRegistry.getInstance();