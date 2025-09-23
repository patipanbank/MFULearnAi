"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parallelToolExecutor = exports.ToolExecutionBuilder = exports.ParallelToolExecutor = void 0;
const events_1 = require("events");
const perf_hooks_1 = require("perf_hooks");
const uuid_1 = require("uuid");
class ParallelToolExecutor extends events_1.EventEmitter {
    constructor() {
        super();
        this.activeBatches = new Map();
        this.toolRegistry = new Map();
        this.performanceMetrics = new Map();
        this.concurrencyLimit = 5;
        this.activeExecutions = 0;
        this.setupPerformanceTracking();
    }
    static getInstance() {
        if (!ParallelToolExecutor.instance) {
            ParallelToolExecutor.instance = new ParallelToolExecutor();
        }
        return ParallelToolExecutor.instance;
    }
    async executeParallelTools(executions, sessionContext) {
        const batchId = (0, uuid_1.v4)();
        const batch = {
            id: batchId,
            executions,
            results: new Map(),
            startTime: perf_hooks_1.performance.now(),
            status: 'pending'
        };
        this.activeBatches.set(batchId, batch);
        try {
            console.log(`🚀 Starting parallel tool execution batch: ${batchId}`);
            console.log(`📋 Tools to execute: ${executions.map(e => e.toolName).join(', ')}`);
            const dependencyGraph = this.buildDependencyGraph(executions);
            this.validateDependencyGraph(dependencyGraph);
            batch.status = 'running';
            await this.executeByLevels(batch, dependencyGraph, sessionContext);
            batch.status = 'completed';
            batch.endTime = perf_hooks_1.performance.now();
            console.log(`✅ Batch completed: ${batchId} in ${(batch.endTime - batch.startTime).toFixed(2)}ms`);
            this.updateBatchMetrics(batch);
            return batch.results;
        }
        catch (error) {
            batch.status = 'failed';
            batch.endTime = perf_hooks_1.performance.now();
            console.error(`❌ Batch failed: ${batchId} - ${error}`);
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
        }
        finally {
            this.activeBatches.delete(batchId);
        }
    }
    async executeSingleTool(toolName, inputs, options = {}) {
        const execution = {
            id: (0, uuid_1.v4)(),
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
        return results.get(execution.id);
    }
    buildDependencyGraph(executions) {
        const graph = {
            nodes: new Set(),
            edges: new Map(),
            levels: []
        };
        executions.forEach(exec => {
            graph.nodes.add(exec.id);
            graph.edges.set(exec.id, new Set());
        });
        executions.forEach(exec => {
            exec.dependsOn.forEach(depId => {
                if (graph.nodes.has(depId)) {
                    graph.edges.get(depId).add(exec.id);
                }
            });
        });
        graph.levels = this.calculateExecutionLevels(executions);
        return graph;
    }
    calculateExecutionLevels(executions) {
        const levels = [];
        const executionMap = new Map(executions.map(e => [e.id, e]));
        const processed = new Set();
        while (processed.size < executions.length) {
            const currentLevel = [];
            for (const execution of executions) {
                if (processed.has(execution.id))
                    continue;
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
    validateDependencyGraph(graph) {
        for (const [nodeId, dependencies] of graph.edges.entries()) {
            if (dependencies.has(nodeId)) {
                throw new Error(`Self-reference detected in tool ${nodeId}`);
            }
        }
    }
    async executeByLevels(batch, graph, sessionContext) {
        const executionMap = new Map(batch.executions.map(e => [e.id, e]));
        for (let levelIndex = 0; levelIndex < graph.levels.length; levelIndex++) {
            const level = graph.levels[levelIndex];
            console.log(`📊 Executing level ${levelIndex + 1}: ${level.length} tools`);
            const levelExecutions = level.map(id => executionMap.get(id));
            const parallelExecutions = levelExecutions.filter(e => e.parallel);
            const sequentialExecutions = levelExecutions.filter(e => !e.parallel);
            if (parallelExecutions.length > 0) {
                await this.executeParallelBatch(parallelExecutions, batch, sessionContext);
            }
            for (const execution of sequentialExecutions) {
                await this.executeWithRetry(execution, batch, sessionContext);
            }
            const failedRequired = levelExecutions.filter(e => !e.optional &&
                (!batch.results.has(e.id) || !batch.results.get(e.id).success));
            if (failedRequired.length > 0) {
                throw new Error(`Required tools failed: ${failedRequired.map(e => e.toolName).join(', ')}`);
            }
        }
    }
    async executeParallelBatch(executions, batch, sessionContext) {
        const chunks = this.chunkArray(executions, this.concurrencyLimit);
        for (const chunk of chunks) {
            const promises = chunk.map(execution => this.executeWithRetry(execution, batch, sessionContext));
            await Promise.allSettled(promises);
        }
    }
    async executeWithRetry(execution, batch, sessionContext) {
        let lastError = null;
        let attempts = 0;
        while (attempts <= execution.retryCount) {
            try {
                this.activeExecutions++;
                const result = await this.executeToolWithTimeout(execution, sessionContext);
                batch.results.set(execution.id, result);
                this.emit('tool_executed', {
                    batchId: batch.id,
                    execution,
                    result,
                    attempt: attempts + 1
                });
                return;
            }
            catch (error) {
                lastError = error;
                attempts++;
                console.warn(`⚠️ Tool ${execution.toolName} failed (attempt ${attempts}): ${error}`);
                this.emit('tool_retry', {
                    batchId: batch.id,
                    execution,
                    error: lastError,
                    attempt: attempts
                });
                if (attempts <= execution.retryCount) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
                }
            }
            finally {
                this.activeExecutions--;
            }
        }
        const failureResult = {
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
        this.emit('tool_failed', {
            batchId: batch.id,
            execution,
            result: failureResult
        });
        if (!execution.optional) {
            throw new Error(`Required tool ${execution.toolName} failed after ${execution.retryCount + 1} attempts`);
        }
    }
    async executeToolWithTimeout(execution, sessionContext) {
        const startTime = perf_hooks_1.performance.now();
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
                    duration: perf_hooks_1.performance.now() - startTime,
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
    async executeTool(execution, sessionContext) {
        console.log(`🔧 Executing tool: ${execution.toolName}`);
        switch (execution.toolName) {
            case 'memory_search':
                return { memories: [], relevance: 0.8 };
            case 'web_search':
                return { results: [], urls: [] };
            case 'calculator':
                if (execution.inputs.expression) {
                    try {
                        return { result: execution.inputs.expression };
                    }
                    catch {
                        throw new Error('Invalid calculation expression');
                    }
                }
                throw new Error('No expression provided');
            case 'current_date':
                return { date: new Date().toISOString() };
            default:
                const tool = this.toolRegistry.get(execution.toolName);
                if (tool) {
                    return await tool.execute(execution.inputs, sessionContext);
                }
                throw new Error(`Unknown tool: ${execution.toolName}`);
        }
    }
    setupPerformanceTracking() {
        this.on('tool_executed', (event) => {
            this.updateToolMetrics(event.execution.toolName, event.result);
        });
        this.on('tool_failed', (event) => {
            this.updateToolMetrics(event.execution.toolName, event.result);
        });
    }
    updateToolMetrics(toolName, result) {
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
        metrics.totalExecutions++;
        metrics.lastExecuted = new Date();
        const prevWeight = (metrics.totalExecutions - 1) / metrics.totalExecutions;
        const newWeight = 1 / metrics.totalExecutions;
        metrics.averageDuration = (metrics.averageDuration * prevWeight) + (result.duration * newWeight);
        metrics.averageInputSize = (metrics.averageInputSize * prevWeight) + (result.inputSize * newWeight);
        metrics.averageOutputSize = (metrics.averageOutputSize * prevWeight) + (result.outputSize * newWeight);
        const successCount = metrics.totalExecutions * metrics.successRate + (result.success ? 1 : 0);
        metrics.successRate = successCount / metrics.totalExecutions;
        if (!result.success && result.error) {
            const errorKey = this.categorizeError(result.error);
            metrics.errorPatterns[errorKey] = (metrics.errorPatterns[errorKey] || 0) + 1;
        }
    }
    updateBatchMetrics(batch) {
        const duration = batch.endTime - batch.startTime;
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
    calculateParallelEfficiency(batch) {
        const sequentialTime = Array.from(batch.results.values())
            .reduce((sum, result) => sum + result.duration, 0);
        const actualTime = batch.endTime - batch.startTime;
        return sequentialTime / actualTime;
    }
    categorizeError(error) {
        if (error.includes('timeout'))
            return 'timeout';
        if (error.includes('network'))
            return 'network';
        if (error.includes('permission'))
            return 'permission';
        if (error.includes('rate limit'))
            return 'rate_limit';
        return 'other';
    }
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
    registerTool(name, tool) {
        this.toolRegistry.set(name, tool);
        console.log(`🔧 Registered tool: ${name}`);
    }
    getToolMetrics(toolName) {
        if (toolName) {
            const metrics = this.performanceMetrics.get(toolName);
            return metrics ? [metrics] : [];
        }
        return Array.from(this.performanceMetrics.values());
    }
    getActiveBatchesCount() {
        return this.activeBatches.size;
    }
    getActiveExecutionsCount() {
        return this.activeExecutions;
    }
    setConcurrencyLimit(limit) {
        this.concurrencyLimit = Math.max(1, Math.min(limit, 20));
        console.log(`⚙️ Concurrency limit set to: ${this.concurrencyLimit}`);
    }
    async cancelBatch(batchId) {
        const batch = this.activeBatches.get(batchId);
        if (!batch)
            return false;
        batch.status = 'failed';
        this.activeBatches.delete(batchId);
        this.emit('batch_cancelled', { batchId });
        return true;
    }
    static createExecution(toolName) {
        return new ToolExecutionBuilder(toolName);
    }
}
exports.ParallelToolExecutor = ParallelToolExecutor;
class ToolExecutionBuilder {
    constructor(toolName) {
        this.execution = {
            id: (0, uuid_1.v4)(),
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
    withInputs(inputs) {
        this.execution.inputs = inputs;
        return this;
    }
    withPriority(priority) {
        this.execution.priority = priority;
        return this;
    }
    withTimeout(timeout) {
        this.execution.timeout = timeout;
        return this;
    }
    withRetries(retryCount) {
        this.execution.retryCount = retryCount;
        return this;
    }
    dependsOn(...executionIds) {
        this.execution.dependsOn = executionIds;
        return this;
    }
    sequential() {
        this.execution.parallel = false;
        return this;
    }
    optional() {
        this.execution.optional = true;
        return this;
    }
    build() {
        return this.execution;
    }
}
exports.ToolExecutionBuilder = ToolExecutionBuilder;
exports.parallelToolExecutor = ParallelToolExecutor.getInstance();
//# sourceMappingURL=parallelToolExecutor.js.map