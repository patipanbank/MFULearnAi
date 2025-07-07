import { Injectable, Logger } from '@nestjs/common';
import { ChromaService } from '../../services/chroma.service';
import { BedrockService } from '../../infrastructure/bedrock/bedrock.service';
import axios from 'axios';

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  execute: (params: any) => Promise<ToolResult>;
}

@Injectable()
export class ToolService {
  private readonly logger = new Logger(ToolService.name);
  private readonly tools = new Map<string, Tool>();

  constructor(
    private readonly chromaService: ChromaService,
    private readonly bedrockService: BedrockService,
  ) {
    this.initializeTools();
  }

  private initializeTools() {
    // Calculator Tool
    this.registerTool({
      name: 'calculator',
      description: 'Performs mathematical calculations. Supports basic arithmetic operations (+, -, *, /, %, ^) and functions like sqrt, sin, cos, tan, log, etc.',
      inputSchema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate (e.g., "2 + 3 * 4", "sqrt(16)", "sin(30)")'
          }
        },
        required: ['expression']
      },
      execute: this.calculateExpression.bind(this)
    });

    // Web Search Tool
    this.registerTool({
      name: 'web_search',
      description: 'Searches the web for current information on any topic. Useful for getting up-to-date information, news, or facts.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for finding relevant information'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5)',
            default: 5
          }
        },
        required: ['query']
      },
      execute: this.searchWeb.bind(this)
    });

    // Document Retrieval Tool
    this.registerTool({
      name: 'document_search',
      description: 'Searches through document collections to find relevant information. Useful for finding specific information from uploaded documents.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for finding relevant documents'
          },
          collection: {
            type: 'string',
            description: 'Document collection name to search in'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5)',
            default: 5
          }
        },
        required: ['query', 'collection']
      },
      execute: this.searchDocuments.bind(this)
    });

    // Text Summary Tool
    this.registerTool({
      name: 'text_summary',
      description: 'Summarizes long text content into concise key points. Useful for processing large amounts of text.',
      inputSchema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Text content to summarize'
          },
          max_length: {
            type: 'number',
            description: 'Maximum length of summary in words (default: 100)',
            default: 100
          }
        },
        required: ['text']
      },
      execute: this.summarizeText.bind(this)
    });

    // Current Time Tool
    this.registerTool({
      name: 'current_time',
      description: 'Gets the current date and time. Useful for time-sensitive information or scheduling.',
      inputSchema: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'Timezone (default: Asia/Bangkok)',
            default: 'Asia/Bangkok'
          },
          format: {
            type: 'string',
            description: 'Date format (iso, local, custom)',
            default: 'iso'
          }
        }
      },
      execute: this.getCurrentTime.bind(this)
    });

    this.logger.log(`🔧 Initialized ${this.tools.size} tools: ${Array.from(this.tools.keys()).join(', ')}`);
  }

  registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);
    this.logger.debug(`✅ Registered tool: ${tool.name}`);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  async executeTool(name: string, params: any): Promise<ToolResult> {
    const tool = this.getTool(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`
      };
    }

    try {
      this.logger.debug(`🔧 Executing tool: ${name} with params:`, params);
      const result = await tool.execute(params);
      this.logger.debug(`✅ Tool ${name} executed successfully`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Tool ${name} execution failed:`, errorMessage);
      return {
        success: false,
        error: `Tool execution failed: ${errorMessage}`
      };
    }
  }

  // Tool Implementations
  private async calculateExpression(params: { expression: string }): Promise<ToolResult> {
    try {
      const { expression } = params;
      
      // Basic security: only allow safe mathematical expressions
      const safeExpression = expression.replace(/[^0-9+\-*/().\s\w]/g, '');
      
      // Use a safe eval alternative or math library
      const result = this.evaluateMathExpression(safeExpression);
      
      return {
        success: true,
        data: {
          expression,
          result,
          type: typeof result
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Calculation error: ${error instanceof Error ? error.message : 'Invalid expression'}`
      };
    }
  }

  private evaluateMathExpression(expression: string): number {
    // Simple math evaluator - in production, use a proper math library like math.js
    const cleanExpression = expression.replace(/\s/g, '');
    
    // Basic math operations
    try {
      // This is a simplified version - replace with a proper math parser
      return Function(`"use strict"; return (${cleanExpression})`)();
    } catch {
      throw new Error('Invalid mathematical expression');
    }
  }

  private async searchWeb(params: { query: string; limit?: number }): Promise<ToolResult> {
    try {
      const { query, limit = 5 } = params;
      
      // This would integrate with a search API like Google Custom Search, Bing, etc.
      // For now, return a mock response
      const results = [
        {
          title: `Search results for: ${query}`,
          url: 'https://example.com',
          snippet: `This is a mock search result for the query: ${query}`,
          timestamp: new Date().toISOString()
        }
      ];

      return {
        success: true,
        data: {
          query,
          results: results.slice(0, limit),
          count: results.length
        },
        metadata: {
          search_time: new Date().toISOString(),
          total_results: results.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async searchDocuments(params: { query: string; collection: string; limit?: number }): Promise<ToolResult> {
    try {
      const { query, collection, limit = 5 } = params;
      
      // Create embedding for the query
      const queryEmbedding = await this.bedrockService.createTextEmbedding(query);
      
      if (!queryEmbedding || queryEmbedding.length === 0) {
        throw new Error('Failed to create query embedding');
      }

      // Search in ChromaDB
      const searchResults = await this.chromaService.queryCollection(collection, queryEmbedding, limit);
      
      return {
        success: true,
        data: {
          query,
          collection,
          results: searchResults?.documents || [],
          metadata: searchResults?.metadatas || [],
          distances: searchResults?.distances || []
        },
        metadata: {
          search_time: new Date().toISOString(),
          collection_name: collection
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Document search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async summarizeText(params: { text: string; max_length?: number }): Promise<ToolResult> {
    try {
      const { text, max_length = 100 } = params;
      
      if (!text || text.length === 0) {
        throw new Error('Text content is required');
      }

      // Simple text summarization - split into sentences and take first few
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const wordsPerSentence = max_length / Math.min(sentences.length, 3);
      
      let summary = '';
      let wordCount = 0;
      
      for (const sentence of sentences) {
        const words = sentence.trim().split(/\s+/);
        if (wordCount + words.length <= max_length) {
          summary += sentence.trim() + '. ';
          wordCount += words.length;
        } else {
          break;
        }
      }

      return {
        success: true,
        data: {
          original_length: text.length,
          summary: summary.trim(),
          summary_length: summary.trim().length,
          word_count: wordCount,
          compression_ratio: Math.round((summary.length / text.length) * 100)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Text summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async getCurrentTime(params: { timezone?: string; format?: string } = {}): Promise<ToolResult> {
    try {
      const { timezone = 'Asia/Bangkok', format = 'iso' } = params;
      
      const now = new Date();
      let formattedTime: string;
      
      switch (format) {
        case 'iso':
          formattedTime = now.toISOString();
          break;
        case 'local':
          formattedTime = now.toLocaleString('en-US', { timeZone: timezone });
          break;
        default:
          formattedTime = now.toISOString();
      }

      return {
        success: true,
        data: {
          timestamp: formattedTime,
          timezone,
          unix_timestamp: Math.floor(now.getTime() / 1000),
          day_of_week: now.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }),
          month: now.toLocaleDateString('en-US', { month: 'long', timeZone: timezone })
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Time retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
} 