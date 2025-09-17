/**
 * Agent Execution Service
 *
 * ระบบจัดการ Agent Execution
 * - Performance monitoring และ metrics
 * - Execution queue management
 * - Error handling และ recovery
 * - Resource optimization
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';
import { unifiedToolRegistry, ToolExecutionContext } from './unifiedToolRegistry';
import { createAgent } from '../agent/agentFactory';
import { getLLM } from '../agent/llmFactory';
import { toolRegistry, createMemoryTool, createRetrievalTools, ToolFunction } from '../agent/toolRegistry';
import { AgentExecutionStatus, TokenUsage } from '../models/agent';

export interface ExecutionRequest {
  id: string;
  chatId: string;
  userId: string;
  agentId?: string;
  prompt: string;
  context: any;
  priority: ExecutionPriority;
  timeout?: number;
  retryCount?: number;
  createdAt: Date;
}

export interface ExecutionResult {
  id: string;
  success: boolean;
  result?: string;
  error?: string;
  metrics: ExecutionMetrics;
  toolExecutions: ToolExecutionMetrics[];
}

export interface ExecutionMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  tokenUsage: TokenUsage;
  toolCount: number;
  retryCount: number;
  memoryUsage?: number;
}

export interface ToolExecutionMetrics {
  toolId: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  inputSize: number;
  outputSize: number;
}

export enum ExecutionPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

export enum ExecutionStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled'
}

export class AgentExecutionService extends EventEmitter {
  private static instance: AgentExecutionService;
  private executionQueue: Map<string, ExecutionRequest> = new Map();
  private activeExecutions: Map<string, ExecutionContext> = new Map();
  private executionHistory: Map<string, ExecutionResult> = new Map();
  private agentCache: Map<string, CachedAgent> = new Map();
  private metrics: ServiceMetrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    averageExecutionTime: 0,
    totalTokensUsed: 0,
    activeExecutions: 0,
    queueSize: 0
  };

  private constructor() {
    super();
    this.startMetricsCollection();
    this.startCacheCleanup();
  }

  public static getInstance(): AgentExecutionService {
    if (!AgentExecutionService.instance) {
      AgentExecutionService.instance = new AgentExecutionService();
    }
    return AgentExecutionService.instance;
  }

  // ================== EXECUTION MANAGEMENT ==================

  /**
   * Execute agent with monitoring
   */
  public async executeAgent(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = performance.now();
    const executionId = request.id;

    try {
      // Add to queue first
      this.executionQueue.set(executionId, request);
      this.updateMetrics();

      // Create execution context
      const context = await this.createExecutionContext(request);
      this.activeExecutions.set(executionId, context);

      // Remove from queue, add to active
      this.executionQueue.delete(executionId);
      this.updateMetrics();

      // Execute with monitoring
      const result = await this.performExecution(context);

      // Record successful execution
      this.metrics.successfulExecutions++;
      this.updateExecutionHistory(executionId, result);

      return result;

    } catch (error) {
      // Record failed execution
      this.metrics.failedExecutions++;

      const failureResult: ExecutionResult = {
        id: executionId,
        success: false,
        error: (error as Error).message,
        metrics: {
          startTime,
          endTime: performance.now(),
          duration: performance.now() - startTime,
          tokenUsage: { input: 0, output: 0 },
          toolCount: 0,
          retryCount: request.retryCount || 0
        },
        toolExecutions: []
      };

      this.updateExecutionHistory(executionId, failureResult);
      return failureResult;

    } finally {
      // Cleanup
      this.activeExecutions.delete(executionId);
      this.updateMetrics();
    }
  }

  /**
   * Create execution context with resource allocation
   */
  private async createExecutionContext(request: ExecutionRequest): Promise<ExecutionContext> {
    const { chatId, userId, agentId, context } = request;

    // Get or create cached agent
    const cacheKey = this.generateAgentCacheKey(request);
    let agent = this.agentCache.get(cacheKey);

    if (!agent || this.isAgentExpired(agent)) {
      console.log(`🤖 Creating agent for execution ${request.id}`);

      // Create tool context
      const toolContext: ToolExecutionContext = {
        sessionId: chatId,
        userId,
        agentId,
        collectionNames: context?.collectionNames || [],
        config: context
      };

      // Get available tools
      const availableTools = unifiedToolRegistry.getAvailableTools(toolContext);

      // Create session and collection tools
      if (chatId) {
        unifiedToolRegistry.createSessionTools(chatId);
      }
      if (context?.collectionNames?.length > 0) {
        unifiedToolRegistry.createCollectionTools(context.collectionNames);
      }

      // Create LLM and agent
      const llm = getLLM(context?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0', {
        temperature: context?.temperature || 0.7,
        maxTokens: context?.maxTokens || 4000,
        streaming: true
      });

      // Setup tools using both unified registry and legacy tools
      const sessionTools = createMemoryTool(chatId);
      const allTools: { [name: string]: ToolFunction } = {};

      // Add legacy registry tools for compatibility
      for (const [k, v] of Object.entries(toolRegistry)) {
        allTools[k] = v.func;
      }

      // Add session tools
      for (const [k, v] of Object.entries(sessionTools)) {
        allTools[k] = v.func;
      }

      // Add retrieval tools if collections specified
      if (context?.collectionNames && context.collectionNames.length > 0) {
        const retrievalTools = createRetrievalTools(context.collectionNames);
        for (const [name, tool] of Object.entries(retrievalTools)) {
          allTools[name] = (tool as any).func;
        }
      }

      const agentExecutor = await createAgent(llm, allTools, request.prompt, {
        modelId: context?.modelId,
        sessionId: chatId,
        temperature: context?.temperature,
        maxTokens: context?.maxTokens,
        collectionNames: context?.collectionNames,
        userId,
        agentId
      });

      agent = {
        executor: agentExecutor,
        createdAt: new Date(),
        lastUsed: new Date(),
        usageCount: 0,
        cacheKey
      };

      this.agentCache.set(cacheKey, agent);
    }

    // Update agent usage
    agent.lastUsed = new Date();
    agent.usageCount++;

    return {
      id: request.id,
      request,
      agent: agent.executor,
      startTime: performance.now(),
      status: ExecutionStatus.RUNNING,
      toolExecutions: [],
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Perform actual execution with monitoring
   */
  private async performExecution(context: ExecutionContext): Promise<ExecutionResult> {
    const { request, agent } = context;
    const toolExecutions: ToolExecutionMetrics[] = [];
    let tokenUsage: TokenUsage = { input: 0, output: 0 };

    try {
      // Execute agent with monitoring
      const result = await agent.run(request.context?.chatHistory || [], {
        onEvent: (event: any) => {
          this.handleExecutionEvent(context, event, toolExecutions);

          // Track token usage
          if (event.type === 'end' && event.data) {
            tokenUsage.input += event.data.inputTokens || 0;
            tokenUsage.output += event.data.outputTokens || 0;
          }

          // Emit real-time events
          this.emit('execution_event', {
            executionId: context.id,
            event
          });
        },
        maxSteps: request.context?.maxSteps || 5,
        images: request.context?.images || []
      });

      const endTime = performance.now();

      return {
        id: context.id,
        success: true,
        result,
        metrics: {
          startTime: context.startTime,
          endTime,
          duration: endTime - context.startTime,
          tokenUsage,
          toolCount: toolExecutions.length,
          retryCount: request.retryCount || 0,
          memoryUsage: process.memoryUsage().heapUsed - context.memoryUsage.heapUsed
        },
        toolExecutions
      };

    } catch (error) {
      throw new Error(`Agent execution failed: ${(error as Error).message}`);
    }
  }

  /**
   * Handle execution events with detailed tracking
   */
  private handleExecutionEvent(
    context: ExecutionContext,
    event: any,
    toolExecutions: ToolExecutionMetrics[]
  ): void {
    switch (event.type) {
      case 'tool_start':
        const toolStart: ToolExecutionMetrics = {
          toolId: event.data.tool_name,
          startTime: performance.now(),
          endTime: 0,
          duration: 0,
          success: false,
          inputSize: JSON.stringify(event.data.tool_input || '').length,
          outputSize: 0
        };
        toolExecutions.push(toolStart);
        break;

      case 'tool_result':
      case 'tool_error':
        const lastTool = toolExecutions[toolExecutions.length - 1];
        if (lastTool && lastTool.toolId === event.data.tool_name) {
          lastTool.endTime = performance.now();
          lastTool.duration = lastTool.endTime - lastTool.startTime;
          lastTool.success = event.type === 'tool_result';
          lastTool.outputSize = JSON.stringify(event.data.output || '').length;

          if (event.type === 'tool_error') {
            lastTool.error = event.data.error;
          }

          // Update tool performance in unified registry
          this.updateToolPerformance(lastTool);
        }
        break;
    }
  }

  // ================== PERFORMANCE OPTIMIZATION ==================

  /**
   * Generate cache key for agent
   */
  private generateAgentCacheKey(request: ExecutionRequest): string {
    const { agentId, context } = request;
    return JSON.stringify({
      agentId,
      modelId: context?.modelId,
      temperature: context?.temperature,
      maxTokens: context?.maxTokens,
      collections: context?.collectionNames?.sort(),
      tools: context?.tools?.sort()
    });
  }

  /**
   * Check if cached agent is expired
   */
  private isAgentExpired(agent: CachedAgent): boolean {
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const age = Date.now() - agent.createdAt.getTime();
    return age > maxAge;
  }

  /**
   * Update tool performance metrics
   */
  private updateToolPerformance(toolMetrics: ToolExecutionMetrics): void {
    // This would integrate with the unified tool registry
    // to update performance statistics for each tool
    console.log(`🔧 Tool ${toolMetrics.toolId} executed in ${toolMetrics.duration.toFixed(2)}ms`);
  }

  // ================== MONITORING & METRICS ==================

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.collectMetrics();
    }, 60000); // Every minute
  }

  /**
   * Collect system metrics
   */
  private collectMetrics(): void {
    const memoryUsage = process.memoryUsage();

    this.emit('metrics_collected', {
      timestamp: new Date(),
      service: this.metrics,
      system: {
        memory: memoryUsage,
        activeExecutions: this.activeExecutions.size,
        queueSize: this.executionQueue.size,
        cacheSize: this.agentCache.size
      }
    });
  }

  /**
   * Start cache cleanup process
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupCache();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupCache(): void {
    let cleaned = 0;

    for (const [key, agent] of this.agentCache.entries()) {
      if (this.isAgentExpired(agent)) {
        this.agentCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired agent cache entries`);
    }
  }

  /**
   * Update service metrics
   */
  private updateMetrics(): void {
    this.metrics.activeExecutions = this.activeExecutions.size;
    this.metrics.queueSize = this.executionQueue.size;
    this.metrics.totalExecutions = this.metrics.successfulExecutions + this.metrics.failedExecutions;
  }

  /**
   * Update execution history
   */
  private updateExecutionHistory(executionId: string, result: ExecutionResult): void {
    this.executionHistory.set(executionId, result);

    // Update average execution time
    const totalDuration = Array.from(this.executionHistory.values())
      .reduce((sum, r) => sum + r.metrics.duration, 0);
    this.metrics.averageExecutionTime = totalDuration / this.executionHistory.size;

    // Update total tokens used
    this.metrics.totalTokensUsed += result.metrics.tokenUsage.input + result.metrics.tokenUsage.output;

    // Keep only recent history (last 1000 executions)
    if (this.executionHistory.size > 1000) {
      const oldestKey = this.executionHistory.keys().next().value;
      this.executionHistory.delete(oldestKey);
    }
  }

  // ================== PUBLIC API ==================

  /**
   * Get service metrics
   */
  public getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get execution history
   */
  public getExecutionHistory(limit: number = 100): ExecutionResult[] {
    return Array.from(this.executionHistory.values()).slice(-limit);
  }

  /**
   * Get tool performance statistics
   */
  public getToolStatistics(): any {
    return unifiedToolRegistry.getToolStatistics();
  }

  /**
   * Cancel execution
   */
  public async cancelExecution(executionId: string): Promise<boolean> {
    if (this.executionQueue.has(executionId)) {
      this.executionQueue.delete(executionId);
      return true;
    }

    if (this.activeExecutions.has(executionId)) {
      const context = this.activeExecutions.get(executionId)!;
      context.status = ExecutionStatus.CANCELLED;
      this.activeExecutions.delete(executionId);
      return true;
    }

    return false;
  }

  /**
   * Get queue status
   */
  public getQueueStatus(): QueueStatus {
    return {
      queueSize: this.executionQueue.size,
      activeExecutions: this.activeExecutions.size,
      cacheSize: this.agentCache.size,
      averageWaitTime: this.calculateAverageWaitTime()
    };
  }

  private calculateAverageWaitTime(): number {
    // Calculate based on recent execution history
    const recentExecutions = Array.from(this.executionHistory.values()).slice(-10);
    if (recentExecutions.length === 0) return 0;

    const avgDuration = recentExecutions.reduce((sum, e) => sum + e.metrics.duration, 0) / recentExecutions.length;
    return avgDuration * this.executionQueue.size;
  }
}

// ================== INTERFACES ==================

interface ExecutionContext {
  id: string;
  request: ExecutionRequest;
  agent: any;
  startTime: number;
  status: ExecutionStatus;
  toolExecutions: ToolExecutionMetrics[];
  memoryUsage: NodeJS.MemoryUsage;
}

interface CachedAgent {
  executor: any;
  createdAt: Date;
  lastUsed: Date;
  usageCount: number;
  cacheKey: string;
}

interface ServiceMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  totalTokensUsed: number;
  activeExecutions: number;
  queueSize: number;
}

interface QueueStatus {
  queueSize: number;
  activeExecutions: number;
  cacheSize: number;
  averageWaitTime: number;
}

// Export singleton instance
export const agentExecutionService = AgentExecutionService.getInstance();