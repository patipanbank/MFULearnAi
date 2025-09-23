"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modernAgentExecutionService = exports.ModernAgentExecutionService = exports.ExecutionStatus = exports.ExecutionPriority = void 0;
const events_1 = require("events");
const perf_hooks_1 = require("perf_hooks");
const modernAgentSystem_1 = require("./modernAgentSystem");
const agentService_1 = require("../services/agentService");
const messages_1 = require("@langchain/core/messages");
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
})(ExecutionStatus || (exports.ExecutionStatus = ExecutionStatus = {}));
class ModernAgentExecutionService extends events_1.EventEmitter {
    constructor() {
        super();
        this.executionQueue = new Map();
        this.activeExecutions = new Map();
        this.executionResults = new Map();
        this.maxConcurrentExecutions = 5;
        console.log('🚀 Modern Agent Execution Service initialized');
    }
    async execute(request) {
        console.log(`🎯 Executing request ${request.id} for chat ${request.chatId}`);
        const startTime = perf_hooks_1.performance.now();
        const streamingEvents = [];
        let toolsUsed = [];
        let iterations = 0;
        let inputTokens = 0;
        let outputTokens = 0;
        let memoryQueries = 0;
        try {
            this.activeExecutions.set(request.id, request);
            const agentConfig = {
                modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
                systemPrompt: "You are a helpful assistant. Use tools when appropriate to provide accurate and relevant information.",
                sessionId: request.chatId,
                userId: request.userId,
                temperature: 0.7,
                maxTokens: 4000,
                maxIterations: 5
            };
            if (request.agentId) {
                try {
                    const customAgent = await agentService_1.agentService.getAgentById(request.agentId);
                    if (customAgent) {
                        agentConfig.modelId = customAgent.modelId;
                        agentConfig.systemPrompt = customAgent.systemPrompt || agentConfig.systemPrompt;
                        agentConfig.temperature = customAgent.temperature || 0.7;
                        agentConfig.maxTokens = customAgent.maxTokens || 4000;
                        agentConfig.collectionNames = customAgent.collectionNames || [];
                        agentConfig.agentId = request.agentId;
                        console.log(`🎯 Using custom agent: ${customAgent.name}`);
                    }
                }
                catch (error) {
                    console.warn(`⚠️ Failed to load custom agent ${request.agentId}:`, error);
                }
            }
            const chatHistory = request.chatHistory
                .slice(-10)
                .map(msg => msg.role === 'user'
                ? new messages_1.HumanMessage(msg.content)
                : new messages_1.AIMessage(msg.content));
            chatHistory.push(new messages_1.HumanMessage(request.userMessage));
            console.log(`📚 Using ${chatHistory.length} messages for context`);
            const modernAgent = await (0, modernAgentSystem_1.createModernAgent)(agentConfig);
            const onStreamingEvent = (event) => {
                const streamingEvent = {
                    type: event.type,
                    data: event.data,
                    timestamp: perf_hooks_1.performance.now()
                };
                streamingEvents.push(streamingEvent);
                if (event.type === 'tool_start') {
                    toolsUsed.push(event.data.tool_name || 'unknown');
                }
                else if (event.type === 'end') {
                    inputTokens = event.data.inputTokens || 0;
                    outputTokens = event.data.outputTokens || 0;
                    iterations = event.data.iterations || 0;
                }
                this.emit('execution_event', {
                    executionId: request.id,
                    event: streamingEvent
                });
            };
            console.log(`🤖 Running Modern Agent for request ${request.id}...`);
            const result = await modernAgent.run(chatHistory, onStreamingEvent);
            const endTime = perf_hooks_1.performance.now();
            const executionResult = {
                id: request.id,
                success: true,
                result,
                metrics: {
                    startTime,
                    endTime,
                    duration: endTime - startTime,
                    tokenUsage: {
                        input: inputTokens,
                        output: outputTokens
                    },
                    iterations,
                    toolsUsed: [...new Set(toolsUsed)],
                    memoryQueries
                },
                streamingEvents
            };
            this.executionResults.set(request.id, executionResult);
            console.log(`✅ Request ${request.id} completed successfully in ${(endTime - startTime).toFixed(2)}ms`);
            return executionResult;
        }
        catch (error) {
            const endTime = perf_hooks_1.performance.now();
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ Request ${request.id} failed:`, error);
            const executionResult = {
                id: request.id,
                success: false,
                error: errorMessage,
                metrics: {
                    startTime,
                    endTime,
                    duration: endTime - startTime,
                    tokenUsage: {
                        input: inputTokens,
                        output: outputTokens
                    },
                    iterations,
                    toolsUsed: [...new Set(toolsUsed)],
                    memoryQueries
                },
                streamingEvents
            };
            this.executionResults.set(request.id, executionResult);
            this.emit('execution_event', {
                executionId: request.id,
                event: {
                    type: 'error',
                    data: { error: errorMessage },
                    timestamp: perf_hooks_1.performance.now()
                }
            });
            return executionResult;
        }
        finally {
            this.activeExecutions.delete(request.id);
        }
    }
    async queueExecution(request) {
        console.log(`📋 Queuing execution request ${request.id}`);
        this.executionQueue.set(request.id, request);
        this.emit('execution_queued', {
            executionId: request.id,
            priority: request.priority
        });
        if (this.activeExecutions.size < this.maxConcurrentExecutions) {
            setImmediate(() => this.processQueue());
        }
    }
    async processQueue() {
        if (this.activeExecutions.size >= this.maxConcurrentExecutions) {
            console.log(`⏳ Max concurrent executions reached (${this.maxConcurrentExecutions})`);
            return;
        }
        let highestPriorityRequest = null;
        let highestPriority = -1;
        for (const request of this.executionQueue.values()) {
            if (request.priority > highestPriority) {
                highestPriority = request.priority;
                highestPriorityRequest = request;
            }
        }
        if (!highestPriorityRequest) {
            return;
        }
        this.executionQueue.delete(highestPriorityRequest.id);
        try {
            await this.execute(highestPriorityRequest);
        }
        catch (error) {
            console.error(`❌ Execution failed for request ${highestPriorityRequest.id}:`, error);
        }
        if (this.executionQueue.size > 0 && this.activeExecutions.size < this.maxConcurrentExecutions) {
            setImmediate(() => this.processQueue());
        }
    }
    getExecutionResult(executionId) {
        return this.executionResults.get(executionId) || null;
    }
    cancelExecution(executionId) {
        if (this.executionQueue.has(executionId)) {
            this.executionQueue.delete(executionId);
            console.log(`🚫 Cancelled queued execution ${executionId}`);
            return true;
        }
        console.warn(`⚠️ Cannot cancel active execution ${executionId}`);
        return false;
    }
    getStats() {
        const completedResults = Array.from(this.executionResults.values())
            .filter(result => result.success);
        const averageExecutionTime = completedResults.length > 0
            ? completedResults.reduce((sum, result) => sum + result.metrics.duration, 0) / completedResults.length
            : 0;
        return {
            activeExecutions: this.activeExecutions.size,
            queuedExecutions: this.executionQueue.size,
            completedExecutions: this.executionResults.size,
            maxConcurrentExecutions: this.maxConcurrentExecutions,
            averageExecutionTime
        };
    }
    cleanup(maxAge = 3600000) {
        const now = Date.now();
        let cleaned = 0;
        for (const [id, result] of this.executionResults.entries()) {
            if (now - result.metrics.endTime > maxAge) {
                this.executionResults.delete(id);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} old execution results`);
        }
    }
    setMaxConcurrentExecutions(max) {
        this.maxConcurrentExecutions = Math.max(1, max);
        console.log(`⚙️ Max concurrent executions set to ${this.maxConcurrentExecutions}`);
        if (this.executionQueue.size > 0) {
            setImmediate(() => this.processQueue());
        }
    }
}
exports.ModernAgentExecutionService = ModernAgentExecutionService;
exports.modernAgentExecutionService = new ModernAgentExecutionService();
setInterval(() => {
    exports.modernAgentExecutionService.cleanup();
}, 30 * 60 * 1000);
//# sourceMappingURL=modernAgentExecutionService.js.map