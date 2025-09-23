/**
 * ConversationToolManager
 *
 * จัดการ tool execution สำหรับ conversation workflow
 * รองรับ tool routing, execution และ result processing
 */

import { ToolExecution, StreamingEventType } from '../types';
import { unifiedToolRegistry } from '../../services/unifiedToolRegistry';
import { toolRegistry } from '../../agent/toolRegistry';

interface ToolExecutionContext {
  conversationId: string;
  memory: any;
  config: any;
}

export class ConversationToolManager {
  private readonly TOOL_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_CONCURRENT_TOOLS = 3;

  constructor() {
    console.log('🔧 ConversationToolManager initialized');
  }

  // ============= TOOL ROUTING =============

  /**
   * ตัดสินใจว่าควรใช้ tools หรือไม่
   */
  public async shouldUseTools(
    userMessage: string,
    enabledTools: string[],
    memoryContext: string
  ): Promise<boolean> {
    // Simple heuristics for tool usage decision
    const toolKeywords = [
      'search', 'find', 'look up', 'calculate', 'compute',
      'what time', 'current date', 'remember', 'recall',
      'save', 'store', 'search in', 'from documents'
    ];

    const messageText = userMessage.toLowerCase();
    const hasToolKeyword = toolKeywords.some(keyword => messageText.includes(keyword));

    // Check if user is asking about specific collections
    const hasCollectionReference = enabledTools.some(tool =>
      tool.startsWith('search_') && messageText.includes('document')
    );

    // Check for mathematical expressions
    const hasMath = /\\d+\\s*[+\\-*/]\\s*\\d+/.test(messageText);

    return hasToolKeyword || hasCollectionReference || hasMath;
  }

  // ============= TOOL EXECUTION =============

  /**
   * รัน tools ที่จำเป็น
   */
  public async executeTools(
    userMessage: string,
    enabledTools: string[],
    context: ToolExecutionContext,
    onEvent: (event: { type: StreamingEventType; data: any }) => void
  ): Promise<ToolExecution[]> {
    console.log(`🔧 Executing tools for message: ${userMessage.substring(0, 50)}...`);

    const toolsToExecute = this.selectToolsToExecute(userMessage, enabledTools);
    if (toolsToExecute.length === 0) {
      return [];
    }

    const executions: ToolExecution[] = [];

    // Execute tools with concurrency limit
    const semaphore = new Array(Math.min(this.MAX_CONCURRENT_TOOLS, toolsToExecute.length));

    await Promise.all(
      semaphore.map(async (_, index) => {
        while (index < toolsToExecute.length) {
          const toolName = toolsToExecute[index];
          index += semaphore.length;

          try {
            const execution = await this.executeTool(
              toolName,
              userMessage,
              context,
              onEvent
            );
            executions.push(execution);
          } catch (error) {
            console.error(`❌ Tool execution failed: ${toolName}`, error);
            executions.push({
              id: this.generateExecutionId(),
              toolName,
              input: { query: userMessage },
              status: 'failed',
              startTime: new Date(),
              endTime: new Date(),
              duration: 0,
              error: {
                code: 'TOOL_EXECUTION_FAILED',
                message: error instanceof Error ? error.message : 'Tool execution failed',
                timestamp: new Date(),
                retryable: true
              }
            });
          }
        }
      })
    );

    return executions;
  }

  /**
   * เลือก tools ที่จะรัน
   */
  private selectToolsToExecute(userMessage: string, enabledTools: string[]): string[] {
    const messageText = userMessage.toLowerCase();
    const selectedTools: string[] = [];

    // Check for specific tool patterns
    enabledTools.forEach(toolName => {
      if (this.shouldExecuteTool(toolName, messageText)) {
        selectedTools.push(toolName);
      }
    });

    // Prioritize tools (max 3)
    return selectedTools.slice(0, 3);
  }

  /**
   * ตรวจสอบว่าควรรัน tool นี้หรือไม่
   */
  private shouldExecuteTool(toolName: string, messageText: string): boolean {
    const toolPatterns: Record<string, string[]> = {
      'web_search': ['search', 'find', 'look up', 'what is', 'who is'],
      'calculator': ['calculate', 'compute', '+', '-', '*', '/', 'math'],
      'current_date': ['date', 'time', 'today', 'now', 'current'],
      'memory_search': ['remember', 'recall', 'what did', 'previous'],
    };

    // Collection search tools
    if (toolName.startsWith('search_')) {
      return messageText.includes('document') || messageText.includes('search in');
    }

    // Standard tools
    const patterns = toolPatterns[toolName];
    return patterns ? patterns.some(pattern => messageText.includes(pattern)) : false;
  }

  /**
   * รัน tool เดียว
   */
  private async executeTool(
    toolName: string,
    userMessage: string,
    context: ToolExecutionContext,
    onEvent: (event: { type: StreamingEventType; data: any }) => void
  ): Promise<ToolExecution> {
    const executionId = this.generateExecutionId();
    const startTime = new Date();

    // Emit tool start event
    onEvent({
      type: StreamingEventType.TOOL_STARTED,
      data: {
        conversationId: context.conversationId,
        executionId,
        toolName,
        input: { query: userMessage }
      }
    });

    try {
      // Get tool function
      const toolFunction = this.getToolFunction(toolName);
      if (!toolFunction) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      // Prepare tool input
      const toolInput = this.prepareToolInput(toolName, userMessage, context);

      // Execute with timeout
      const output = await Promise.race([
        toolFunction(toolInput),
        this.createTimeoutPromise(this.TOOL_TIMEOUT, `Tool ${toolName} timed out`)
      ]);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Emit tool completion event
      onEvent({
        type: StreamingEventType.TOOL_COMPLETED,
        data: {
          conversationId: context.conversationId,
          executionId,
          toolName,
          output,
          duration
        }
      });

      return {
        id: executionId,
        toolName,
        input: toolInput,
        output,
        status: 'completed',
        startTime,
        endTime,
        duration
      };

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Emit tool failure event
      onEvent({
        type: StreamingEventType.TOOL_FAILED,
        data: {
          conversationId: context.conversationId,
          executionId,
          toolName,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration
        }
      });

      throw error;
    }
  }

  // ============= TOOL UTILITIES =============

  /**
   * ดึง tool function
   */
  private getToolFunction(toolName: string): Function | null {
    // Try unified tool registry first
    const unifiedTool = unifiedToolRegistry.getTool(toolName);
    if (unifiedTool) {
      return unifiedTool.execute.bind(unifiedTool);
    }

    // Try legacy tool registry
    const legacyTool = toolRegistry[toolName];
    if (legacyTool) {
      return legacyTool.func;
    }

    return null;
  }

  /**
   * เตรียม input สำหรับ tool
   */
  private prepareToolInput(toolName: string, userMessage: string, context: ToolExecutionContext): any {
    const baseInput = { query: userMessage };

    // Tool-specific input preparation
    switch (toolName) {
      case 'web_search':
        return { query: this.extractSearchQuery(userMessage) };

      case 'calculator':
        return { expression: this.extractMathExpression(userMessage) };

      case 'memory_search':
        return {
          query: userMessage,
          conversationId: context.conversationId
        };

      default:
        if (toolName.startsWith('search_')) {
          const collectionName = toolName.replace('search_', '');
          return {
            query: userMessage,
            collectionName,
            limit: 5
          };
        }
        return baseInput;
    }
  }

  /**
   * แยก search query จากข้อความ
   */
  private extractSearchQuery(message: string): string {
    // Simple extraction - in real implementation, use NLP
    const patterns = [
      /search for (.+)/i,
      /find (.+)/i,
      /look up (.+)/i,
      /what is (.+)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return message;
  }

  /**
   * แยก mathematical expression
   */
  private extractMathExpression(message: string): string {
    const mathPattern = /([\\d+\\-*/\\s().]+)/;
    const match = message.match(mathPattern);
    return match ? match[1].trim() : message;
  }

  /**
   * สร้าง timeout promise
   */
  private createTimeoutPromise(ms: number, errorMessage: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), ms);
    });
  }

  /**
   * สร้าง execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============= RESULT PROCESSING =============

  /**
   * ประมวลผล tool results สำหรับ LLM
   */
  public formatToolResultsForLLM(executions: ToolExecution[]): string {
    if (executions.length === 0) {
      return '';
    }

    const results: string[] = ['Tool execution results:'];

    executions.forEach(execution => {
      if (execution.status === 'completed' && execution.output) {
        results.push(`\\n${execution.toolName}:`);
        results.push(this.formatToolOutput(execution.toolName, execution.output));
      } else if (execution.status === 'failed') {
        results.push(`\\n${execution.toolName}: Failed - ${execution.error?.message || 'Unknown error'}`);
      }
    });

    return results.join('\\n');
  }

  /**
   * จัดรูปแบบ output ของ tool
   */
  private formatToolOutput(toolName: string, output: any): string {
    if (typeof output === 'string') {
      return output;
    }

    if (typeof output === 'object') {
      // Format based on tool type
      switch (toolName) {
        case 'web_search':
          return this.formatWebSearchOutput(output);
        case 'calculator':
          return `Result: ${output.result || output}`;
        default:
          return JSON.stringify(output, null, 2);
      }
    }

    return String(output);
  }

  /**
   * จัดรูปแบบ web search output
   */
  private formatWebSearchOutput(output: any): string {
    if (output.results && Array.isArray(output.results)) {
      return output.results
        .slice(0, 3)
        .map((result: any) => `- ${result.title}: ${result.snippet}`)
        .join('\\n');
    }
    return String(output);
  }

  // ============= CLEANUP =============

  public cleanup(): void {
    console.log('🧹 ConversationToolManager cleaned up');
  }
}