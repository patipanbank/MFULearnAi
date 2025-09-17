"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentExecutionService = exports.AgentExecutionService = exports.ExecutionStatus = exports.ExecutionPriority = void 0;
const events_1 = require("events");
const perf_hooks_1 = require("perf_hooks");
const unifiedToolRegistry_1 = require("./unifiedToolRegistry");
const agentFactory_1 = require("../agent/agentFactory");
const llmFactory_1 = require("../agent/llmFactory");
const toolRegistry_1 = require("../agent/toolRegistry");
var ExecutionPriority;
(function (ExecutionPriority) {
    ExecutionPriority[ExecutionPriority["LOW"] = 0] = "LOW";
    ExecutionPriority[ExecutionPriority["NORMAL"] = 1] = "NORMAL";
    ExecutionPriority[ExecutionPriority["HIGH"] = 2] = "HIGH";
    ExecutionPriority[ExecutionPriority["CRITICAL"] = 3] = "CRITICAL";
})(ExecutionPriority || (exports.ExecutionPriority = ExecutionPriority = {}));
var ExecutionStatus;
(function (ExecutionStatus) {
    ExecutionStatus["QUEUED"] = "queued";
    ExecutionStatus["RUNNING"] = "running";
    ExecutionStatus["COMPLETED"] = "completed";
    ExecutionStatus["FAILED"] = "failed";
    ExecutionStatus["TIMEOUT"] = "timeout";
    ExecutionStatus["CANCELLED"] = "cancelled";
})(ExecutionStatus || (exports.ExecutionStatus = ExecutionStatus = {}));
class AgentExecutionService extends events_1.EventEmitter {
    constructor() {
        super();
        this.executionQueue = new Map();
        this.activeExecutions = new Map();
        this.executionHistory = new Map();
        this.agentCache = new Map();
        this.metrics = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageExecutionTime: 0,
            totalTokensUsed: 0,
            activeExecutions: 0,
            queueSize: 0
        };
        this.startMetricsCollection();
        this.startCacheCleanup();
    }
    static getInstance() {
        if (!AgentExecutionService.instance) {
            AgentExecutionService.instance = new AgentExecutionService();
        }
        return AgentExecutionService.instance;
    }
    async executeAgent(request) {
        const startTime = perf_hooks_1.performance.now();
        const executionId = request.id;
        try {
            this.executionQueue.set(executionId, request);
            this.updateMetrics();
            const context = await this.createExecutionContext(request);
            this.activeExecutions.set(executionId, context);
            this.executionQueue.delete(executionId);
            this.updateMetrics();
            const result = await this.performExecution(context);
            this.metrics.successfulExecutions++;
            this.updateExecutionHistory(executionId, result);
            return result;
        }
        catch (error) {
            this.metrics.failedExecutions++;
            const failureResult = {
                id: executionId,
                success: false,
                error: error.message,
                metrics: {
                    startTime,
                    endTime: perf_hooks_1.performance.now(),
                    duration: perf_hooks_1.performance.now() - startTime,
                    tokenUsage: { input: 0, output: 0 },
                    toolCount: 0,
                    retryCount: request.retryCount || 0
                },
                toolExecutions: []
            };
            this.updateExecutionHistory(executionId, failureResult);
            return failureResult;
        }
        finally {
            this.activeExecutions.delete(executionId);
            this.updateMetrics();
        }
    }
    async createExecutionContext(request) {
        const { chatId, userId, agentId, context } = request;
        const cacheKey = this.generateAgentCacheKey(request);
        let agent = this.agentCache.get(cacheKey);
        if (!agent || this.isAgentExpired(agent)) {
            console.log(`🤖 Creating agent for execution ${request.id}`);
            const toolContext = {
                sessionId: chatId,
                userId,
                agentId,
                collectionNames: context?.collectionNames || [],
                config: context
            };
            const availableTools = unifiedToolRegistry_1.unifiedToolRegistry.getAvailableTools(toolContext);
            if (chatId) {
                unifiedToolRegistry_1.unifiedToolRegistry.createSessionTools(chatId);
            }
            if (context?.collectionNames?.length > 0) {
                unifiedToolRegistry_1.unifiedToolRegistry.createCollectionTools(context.collectionNames);
            }
            const llm = (0, llmFactory_1.getLLM)(context?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0', {
                temperature: context?.temperature || 0.7,
                maxTokens: context?.maxTokens || 4000,
                streaming: true
            });
            const sessionTools = (0, toolRegistry_1.createMemoryTool)(chatId);
            const allTools = {};
            for (const [k, v] of Object.entries(toolRegistry_1.toolRegistry)) {
                allTools[k] = v.func;
            }
            for (const [k, v] of Object.entries(sessionTools)) {
                allTools[k] = v.func;
            }
            if (context?.collectionNames && context.collectionNames.length > 0) {
                const retrievalTools = (0, toolRegistry_1.createRetrievalTools)(context.collectionNames);
                for (const [name, tool] of Object.entries(retrievalTools)) {
                    allTools[name] = tool.func;
                }
            }
            const agentExecutor = await (0, agentFactory_1.createAgent)(llm, allTools, request.prompt, {
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
        agent.lastUsed = new Date();
        agent.usageCount++;
        return {
            id: request.id,
            request,
            agent: agent.executor,
            startTime: perf_hooks_1.performance.now(),
            status: ExecutionStatus.RUNNING,
            toolExecutions: [],
            memoryUsage: process.memoryUsage()
        };
    }
    async performExecution(context) {
        const { request, agent } = context;
        const toolExecutions = [];
        let tokenUsage = { input: 0, output: 0 };
        try {
            const result = await agent.run(request.context?.chatHistory || [], {
                onEvent: (event) => {
                    this.handleExecutionEvent(context, event, toolExecutions);
                    if (event.type === 'end' && event.data) {
                        tokenUsage.input += event.data.inputTokens || 0;
                        tokenUsage.output += event.data.outputTokens || 0;
                    }
                    this.emit('execution_event', {
                        executionId: context.id,
                        event
                    });
                },
                maxSteps: request.context?.maxSteps || 5,
                images: request.context?.images || []
            });
            const endTime = perf_hooks_1.performance.now();
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
        }
        catch (error) {
            throw new Error(`Agent execution failed: ${error.message}`);
        }
    }
    handleExecutionEvent(context, event, toolExecutions) {
        switch (event.type) {
            case 'tool_start':
                const toolStart = {
                    toolId: event.data.tool_name,
                    startTime: perf_hooks_1.performance.now(),
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
                    lastTool.endTime = perf_hooks_1.performance.now();
                    lastTool.duration = lastTool.endTime - lastTool.startTime;
                    lastTool.success = event.type === 'tool_result';
                    lastTool.outputSize = JSON.stringify(event.data.output || '').length;
                    if (event.type === 'tool_error') {
                        lastTool.error = event.data.error;
                    }
                    this.updateToolPerformance(lastTool);
                }
                break;
        }
    }
    generateAgentCacheKey(request) {
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
    isAgentExpired(agent) {
        const maxAge = 30 * 60 * 1000;
        const age = Date.now() - agent.createdAt.getTime();
        return age > maxAge;
    }
    updateToolPerformance(toolMetrics) {
        console.log(`🔧 Tool ${toolMetrics.toolId} executed in ${toolMetrics.duration.toFixed(2)}ms`);
    }
    startMetricsCollection() {
        setInterval(() => {
            this.collectMetrics();
        }, 60000);
    }
    collectMetrics() {
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
    startCacheCleanup() {
        setInterval(() => {
            this.cleanupCache();
        }, 5 * 60 * 1000);
    }
    cleanupCache() {
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
    updateMetrics() {
        this.metrics.activeExecutions = this.activeExecutions.size;
        this.metrics.queueSize = this.executionQueue.size;
        this.metrics.totalExecutions = this.metrics.successfulExecutions + this.metrics.failedExecutions;
    }
    updateExecutionHistory(executionId, result) {
        this.executionHistory.set(executionId, result);
        const totalDuration = Array.from(this.executionHistory.values())
            .reduce((sum, r) => sum + r.metrics.duration, 0);
        this.metrics.averageExecutionTime = totalDuration / this.executionHistory.size;
        this.metrics.totalTokensUsed += result.metrics.tokenUsage.input + result.metrics.tokenUsage.output;
        if (this.executionHistory.size > 1000) {
            const oldestKey = this.executionHistory.keys().next().value;
            if (oldestKey) {
                this.executionHistory.delete(oldestKey);
            }
        }
    }
    getMetrics() {
        return { ...this.metrics };
    }
    getExecutionHistory(limit = 100) {
        return Array.from(this.executionHistory.values()).slice(-limit);
    }
    getToolStatistics() {
        return unifiedToolRegistry_1.unifiedToolRegistry.getToolStatistics();
    }
    async cancelExecution(executionId) {
        if (this.executionQueue.has(executionId)) {
            this.executionQueue.delete(executionId);
            return true;
        }
        if (this.activeExecutions.has(executionId)) {
            const context = this.activeExecutions.get(executionId);
            context.status = ExecutionStatus.CANCELLED;
            this.activeExecutions.delete(executionId);
            return true;
        }
        return false;
    }
    getQueueStatus() {
        return {
            queueSize: this.executionQueue.size,
            activeExecutions: this.activeExecutions.size,
            cacheSize: this.agentCache.size,
            averageWaitTime: this.calculateAverageWaitTime()
        };
    }
    calculateAverageWaitTime() {
        const recentExecutions = Array.from(this.executionHistory.values()).slice(-10);
        if (recentExecutions.length === 0)
            return 0;
        const avgDuration = recentExecutions.reduce((sum, e) => sum + e.metrics.duration, 0) / recentExecutions.length;
        return avgDuration * this.executionQueue.size;
    }
}
exports.AgentExecutionService = AgentExecutionService;
exports.agentExecutionService = AgentExecutionService.getInstance();
//# sourceMappingURL=agentExecutionService.js.map