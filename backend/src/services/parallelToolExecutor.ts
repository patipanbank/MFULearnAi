/**
 * Parallel Tool Executor
 *
 * Advanced tool execution system ที่สามารถรัน multiple tools พร้อมกัน
 * พร้อม dependency management และ result aggregation
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';

// ===== INTERFACES =====

export interface ToolExecution {
  id: string;
  toolName: string;
  inputs: Record<string, any>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timeout: number;
  retryCount: number;
  dependsOn: string[];
  parallel: boolean;
  optional: boolean;
}

export interface ToolResult {
  id: string;
  toolName: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  retryAttempts: number;
  inputSize: number;
  outputSize: number;
  timestamp: Date;
}

export interface ExecutionBatch {
  id: string;
  executions: ToolExecution[];
  results: Map<string, ToolResult>;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
}

export interface ToolPerformanceMetrics {
  toolName: string;
  totalExecutions: number;
  successRate: number;
  averageDuration: number;
  averageInputSize: number;
  averageOutputSize: number;
  errorPatterns: Record<string, number>;
  lastExecuted: Date;
}

export interface DependencyGraph {
  nodes: Set<string>;
  edges: Map<string, Set<string>>;
  levels: string[][];
}

// ===== MAIN EXECUTOR =====

export class ParallelToolExecutor extends EventEmitter {
  private static instance: ParallelToolExecutor;
  private activeBatches: Map<string, ExecutionBatch> = new Map();
  private toolRegistry: Map<string, any> = new Map();
  private performanceMetrics: Map<string, ToolPerformanceMetrics> = new Map();
  private concurrencyLimit = 5; // Maximum concurrent tool executions
  private activeExecutions = 0;

  private constructor() {
    super();
    this.setupPerformanceTracking();
  }

  public static getInstance(): ParallelToolExecutor {
    if (!ParallelToolExecutor.instance) {
      ParallelToolExecutor.instance = new ParallelToolExecutor();
    }
    return ParallelToolExecutor.instance;
  }

  // ===== CORE EXECUTION METHODS =====

  /**
   * Execute multiple tools with dependency management
   */
  public async executeParallelTools(
    executions: ToolExecution[],
    sessionContext?: any
  ): Promise<Map<string, ToolResult>> {
    const batchId = uuidv4();
    const batch: ExecutionBatch = {
      id: batchId,
      executions,
      results: new Map(),
      startTime: performance.now(),
      status: 'pending'
    };

    this.activeBatches.set(batchId, batch);

    try {
      console.log(`🚀 Starting parallel tool execution batch: ${batchId}`);
      console.log(`📋 Tools to execute: ${executions.map(e => e.toolName).join(', ')}`);

      // 1. Build dependency graph
      const dependencyGraph = this.buildDependencyGraph(executions);

      // 2. Validate graph (check for cycles)
      this.validateDependencyGraph(dependencyGraph);

      // 3. Execute in levels
      batch.status = 'running';
      await this.executeByLevels(batch, dependencyGraph, sessionContext);

      // 4. Complete batch
      batch.status = 'completed';
      batch.endTime = performance.now();

      console.log(`✅ Batch completed: ${batchId} in ${(batch.endTime - batch.startTime).toFixed(2)}ms`);

      // 5. Update performance metrics
      this.updateBatchMetrics(batch);

      return batch.results;

    } catch (error) {
      batch.status = 'failed';
      batch.endTime = performance.now();

      console.error(`❌ Batch failed: ${batchId} - ${error}`);

      // Mark failed executions
      for (const execution of executions) {
        if (!batch.results.has(execution.id)) {
          batch.results.set(execution.id, {
            id: execution.id,
            toolName: execution.toolName,
            success: false,
            error: `Batch execution failed: ${error}`,
            duration: 0,
            retryAttempts: 0,
            inputSize: JSON.stringify(execution.inputs).length,
            outputSize: 0,
            timestamp: new Date()
          });
        }
      }

      throw error;

    } finally {
      this.activeBatches.delete(batchId);
    }
  }

  /**
   * Execute single tool with retry logic
   */
  public async executeSingleTool(
    toolName: string,
    inputs: Record<string, any>,
    options: {
      timeout?: number;
      retryCount?: number;
      priority?: 'low' | 'normal' | 'high' | 'critical';
    } = {}
  ): Promise<ToolResult> {
    const execution: ToolExecution = {
      id: uuidv4(),
      toolName,
      inputs,
      priority: options.priority || 'normal',
      timeout: options.timeout || 30000,
      retryCount: options.retryCount || 2,
      dependsOn: [],
      parallel: true,
      optional: false
    };

    const results = await this.executeParallelTools([execution]);
    return results.get(execution.id)!;
  }

  // ===== DEPENDENCY MANAGEMENT =====

  private buildDependencyGraph(executions: ToolExecution[]): DependencyGraph {
    const graph: DependencyGraph = {
      nodes: new Set(),
      edges: new Map(),
      levels: []
    };

    // Add all nodes
    executions.forEach(exec => {
      graph.nodes.add(exec.id);
      graph.edges.set(exec.id, new Set());
    });

    // Add edges (dependencies)
    executions.forEach(exec => {
      exec.dependsOn.forEach(depId => {
        if (graph.nodes.has(depId)) {
          graph.edges.get(depId)!.add(exec.id);
        }
      });
    });

    // Calculate levels using topological sort
    graph.levels = this.calculateExecutionLevels(executions);

    return graph;
  }

  private calculateExecutionLevels(executions: ToolExecution[]): string[][] {
    const levels: string[][] = [];
    const executionMap = new Map(executions.map(e => [e.id, e]));
    const processed = new Set<string>();

    while (processed.size < executions.length) {
      const currentLevel: string[] = [];

      // Find executions with no unprocessed dependencies
      for (const execution of executions) {
        if (processed.has(execution.id)) continue;

        const canExecute = execution.dependsOn.every(depId => processed.has(depId));

        if (canExecute) {
          currentLevel.push(execution.id);
          processed.add(execution.id);
        }
      }

      if (currentLevel.length === 0) {
        throw new Error('Circular dependency detected in tool execution plan');
      }

      levels.push(currentLevel);
    }

    return levels;
  }

  private validateDependencyGraph(graph: DependencyGraph): void {
    // Check for self-references and circular dependencies
    for (const [nodeId, dependencies] of graph.edges.entries()) {
      if (dependencies.has(nodeId)) {
        throw new Error(`Self-reference detected in tool ${nodeId}`);
      }
    }

    // Additional validation could be added here
  }

  // ===== EXECUTION ENGINE =====

  private async executeByLevels(
    batch: ExecutionBatch,
    graph: DependencyGraph,
    sessionContext?: any
  ): Promise<void> {
    const executionMap = new Map(batch.executions.map(e => [e.id, e]));

    for (let levelIndex = 0; levelIndex < graph.levels.length; levelIndex++) {
      const level = graph.levels[levelIndex];
      console.log(`📊 Executing level ${levelIndex + 1}: ${level.length} tools`);

      // Separate parallel and sequential executions
      const levelExecutions = level.map(id => executionMap.get(id)!);
      const parallelExecutions = levelExecutions.filter(e => e.parallel);
      const sequentialExecutions = levelExecutions.filter(e => !e.parallel);

      // Execute parallel tools
      if (parallelExecutions.length > 0) {
        await this.executeParallelBatch(parallelExecutions, batch, sessionContext);
      }

      // Execute sequential tools
      for (const execution of sequentialExecutions) {
        await this.executeWithRetry(execution, batch, sessionContext);
      }

      // Check if any required tools failed
      const failedRequired = levelExecutions.filter(e =>
        !e.optional &&
        (!batch.results.has(e.id) || !batch.results.get(e.id)!.success)
      );

      if (failedRequired.length > 0) {
        throw new Error(`Required tools failed: ${failedRequired.map(e => e.toolName).join(', ')}`);
      }
    }
  }

  private async executeParallelBatch(
    executions: ToolExecution[],
    batch: ExecutionBatch,
    sessionContext?: any
  ): Promise<void> {
    // Respect concurrency limit
    const chunks = this.chunkArray(executions, this.concurrencyLimit);

    for (const chunk of chunks) {
      const promises = chunk.map(execution =>
        this.executeWithRetry(execution, batch, sessionContext)
      );

      await Promise.allSettled(promises);
    }
  }

  private async executeWithRetry(
    execution: ToolExecution,
    batch: ExecutionBatch,
    sessionContext?: any
  ): Promise<void> {
    let lastError: Error | null = null;
    let attempts = 0;

    while (attempts <= execution.retryCount) {
      try {
        this.activeExecutions++;
        const result = await this.executeToolWithTimeout(execution, sessionContext);
        batch.results.set(execution.id, result);

        // Emit success event
        this.emit('tool_executed', {
          batchId: batch.id,
          execution,
          result,
          attempt: attempts + 1
        });

        return;

      } catch (error) {
        lastError = error as Error;
        attempts++;

        console.warn(`⚠️ Tool ${execution.toolName} failed (attempt ${attempts}): ${error}`);

        // Emit retry event
        this.emit('tool_retry', {
          batchId: batch.id,
          execution,
          error: lastError,
          attempt: attempts
        });

        // Wait before retry (exponential backoff)
        if (attempts <= execution.retryCount) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
        }

      } finally {
        this.activeExecutions--;
      }
    }

    // All retries failed
    const failureResult: ToolResult = {
      id: execution.id,
      toolName: execution.toolName,
      success: false,
      error: lastError?.message || 'Unknown error',
      duration: 0,
      retryAttempts: attempts - 1,
      inputSize: JSON.stringify(execution.inputs).length,
      outputSize: 0,
      timestamp: new Date()
    };

    batch.results.set(execution.id, failureResult);

    // Emit failure event
    this.emit('tool_failed', {
      batchId: batch.id,
      execution,
      result: failureResult
    });

    if (!execution.optional) {
      throw new Error(`Required tool ${execution.toolName} failed after ${execution.retryCount + 1} attempts`);
    }
  }

  private async executeToolWithTimeout(
    execution: ToolExecution,
    sessionContext?: any
  ): Promise<ToolResult> {
    const startTime = performance.now();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Tool ${execution.toolName} timed out after ${execution.timeout}ms`));
      }, execution.timeout);

      this.executeTool(execution, sessionContext)
        .then(result => {
          clearTimeout(timeoutId);
          resolve({
            id: execution.id,
            toolName: execution.toolName,
            success: true,
            result,
            duration: performance.now() - startTime,
            retryAttempts: 0,
            inputSize: JSON.stringify(execution.inputs).length,
            outputSize: JSON.stringify(result).length,
            timestamp: new Date()
          });
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private async executeTool(execution: ToolExecution, sessionContext?: any): Promise<any> {
    // This would integrate with the existing tool registry
    console.log(`🔧 Executing tool: ${execution.toolName}`);

    // Mock implementation - would integrate with actual tools
    switch (execution.toolName) {
      case 'memory_search':
        // Simulate memory search
        return { memories: [], relevance: 0.8 };

      case 'web_search':
        // Simulate web search
        return { results: [], urls: [] };

      case 'calculator':
        // Simulate calculation
        if (execution.inputs.expression) {
          try {
            // Safe evaluation would be implemented
            return { result: execution.inputs.expression };
          } catch {
            throw new Error('Invalid calculation expression');
          }
        }
        throw new Error('No expression provided');

      case 'current_date':
        return { date: new Date().toISOString() };

      default:
        // Try to find tool in registry
        const tool = this.toolRegistry.get(execution.toolName);
        if (tool) {
          return await tool.execute(execution.inputs, sessionContext);
        }

        throw new Error(`Unknown tool: ${execution.toolName}`);
    }
  }

  // ===== PERFORMANCE TRACKING =====

  private setupPerformanceTracking(): void {
    this.on('tool_executed', (event) => {
      this.updateToolMetrics(event.execution.toolName, event.result);
    });

    this.on('tool_failed', (event) => {
      this.updateToolMetrics(event.execution.toolName, event.result);
    });
  }

  private updateToolMetrics(toolName: string, result: ToolResult): void {
    let metrics = this.performanceMetrics.get(toolName);

    if (!metrics) {
      metrics = {
        toolName,
        totalExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        averageInputSize: 0,
        averageOutputSize: 0,
        errorPatterns: {},
        lastExecuted: new Date()
      };
      this.performanceMetrics.set(toolName, metrics);
    }

    // Update metrics
    metrics.totalExecutions++;
    metrics.lastExecuted = new Date();

    // Update averages
    const prevWeight = (metrics.totalExecutions - 1) / metrics.totalExecutions;
    const newWeight = 1 / metrics.totalExecutions;

    metrics.averageDuration = (metrics.averageDuration * prevWeight) + (result.duration * newWeight);
    metrics.averageInputSize = (metrics.averageInputSize * prevWeight) + (result.inputSize * newWeight);
    metrics.averageOutputSize = (metrics.averageOutputSize * prevWeight) + (result.outputSize * newWeight);

    // Update success rate
    const successCount = metrics.totalExecutions * metrics.successRate + (result.success ? 1 : 0);
    metrics.successRate = successCount / metrics.totalExecutions;

    // Track error patterns
    if (!result.success && result.error) {
      const errorKey = this.categorizeError(result.error);
      metrics.errorPatterns[errorKey] = (metrics.errorPatterns[errorKey] || 0) + 1;
    }
  }

  private updateBatchMetrics(batch: ExecutionBatch): void {
    const duration = batch.endTime! - batch.startTime;
    const successCount = Array.from(batch.results.values()).filter(r => r.success).length;
    const totalCount = batch.results.size;

    this.emit('batch_completed', {
      batchId: batch.id,
      duration,
      successRate: successCount / totalCount,
      toolsExecuted: totalCount,
      parallelEfficiency: this.calculateParallelEfficiency(batch)
    });
  }

  private calculateParallelEfficiency(batch: ExecutionBatch): number {
    const sequentialTime = Array.from(batch.results.values())
      .reduce((sum, result) => sum + result.duration, 0);

    const actualTime = batch.endTime! - batch.startTime;

    return sequentialTime / actualTime;
  }

  private categorizeError(error: string): string {
    if (error.includes('timeout')) return 'timeout';
    if (error.includes('network')) return 'network';
    if (error.includes('permission')) return 'permission';
    if (error.includes('rate limit')) return 'rate_limit';
    return 'other';
  }

  // ===== UTILITY METHODS =====

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // ===== PUBLIC API =====

  public registerTool(name: string, tool: any): void {
    this.toolRegistry.set(name, tool);
    console.log(`🔧 Registered tool: ${name}`);
  }

  public getToolMetrics(toolName?: string): ToolPerformanceMetrics[] {
    if (toolName) {
      const metrics = this.performanceMetrics.get(toolName);
      return metrics ? [metrics] : [];
    }

    return Array.from(this.performanceMetrics.values());
  }

  public getActiveBatchesCount(): number {
    return this.activeBatches.size;
  }

  public getActiveExecutionsCount(): number {
    return this.activeExecutions;
  }

  public setConcurrencyLimit(limit: number): void {
    this.concurrencyLimit = Math.max(1, Math.min(limit, 20));
    console.log(`⚙️ Concurrency limit set to: ${this.concurrencyLimit}`);
  }

  public async cancelBatch(batchId: string): Promise<boolean> {
    const batch = this.activeBatches.get(batchId);
    if (!batch) return false;

    batch.status = 'failed';
    this.activeBatches.delete(batchId);

    this.emit('batch_cancelled', { batchId });
    return true;
  }

  // ===== BUILDER PATTERN FOR TOOL EXECUTIONS =====

  public static createExecution(toolName: string): ToolExecutionBuilder {
    return new ToolExecutionBuilder(toolName);
  }
}

// ===== BUILDER CLASS =====

export class ToolExecutionBuilder {
  private execution: Partial<ToolExecution>;

  constructor(toolName: string) {
    this.execution = {
      id: uuidv4(),
      toolName,
      inputs: {},
      priority: 'normal',
      timeout: 30000,
      retryCount: 2,
      dependsOn: [],
      parallel: true,
      optional: false
    };
  }

  public withInputs(inputs: Record<string, any>): ToolExecutionBuilder {
    this.execution.inputs = inputs;
    return this;
  }

  public withPriority(priority: 'low' | 'normal' | 'high' | 'critical'): ToolExecutionBuilder {
    this.execution.priority = priority;
    return this;
  }

  public withTimeout(timeout: number): ToolExecutionBuilder {
    this.execution.timeout = timeout;
    return this;
  }

  public withRetries(retryCount: number): ToolExecutionBuilder {
    this.execution.retryCount = retryCount;
    return this;
  }

  public dependsOn(...executionIds: string[]): ToolExecutionBuilder {
    this.execution.dependsOn = executionIds;
    return this;
  }

  public sequential(): ToolExecutionBuilder {
    this.execution.parallel = false;
    return this;
  }

  public optional(): ToolExecutionBuilder {
    this.execution.optional = true;
    return this;
  }

  public build(): ToolExecution {
    return this.execution as ToolExecution;
  }
}

// Export singleton
export const parallelToolExecutor = ParallelToolExecutor.getInstance();