"use strict";
/**
 * Agent Orchestration Service
 *
 * Agentic AI system ที่จัดการ multi-agent coordination, tool pipeline,
 * และ adaptive response generation แบบ Claude Code
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentOrchestrationService = exports.AgentOrchestrationService = exports.TaskPriority = void 0;
const events_1 = require("events");
const perf_hooks_1 = require("perf_hooks");
const uuid_1 = require("uuid");
const agentExecutionService_1 = require("./agentExecutionService");
// Legacy imports - stubs for backwards compatibility
const memoryService_1 = require("./memoryService");
var TaskPriority;
(function (TaskPriority) {
    TaskPriority[TaskPriority["LOW"] = 0] = "LOW";
    TaskPriority[TaskPriority["NORMAL"] = 1] = "NORMAL";
    TaskPriority[TaskPriority["HIGH"] = 2] = "HIGH";
    TaskPriority[TaskPriority["CRITICAL"] = 3] = "CRITICAL";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
// ===== MAIN SERVICE =====
class AgentOrchestrationService extends events_1.EventEmitter {
    constructor() {
        super();
        this.activeTasks = new Map();
        this.executionPlans = new Map();
        this.activeExecutions = new Map();
        this.performanceHistory = [];
        this.setupEventHandlers();
    }
    static getInstance() {
        if (!AgentOrchestrationService.instance) {
            AgentOrchestrationService.instance = new AgentOrchestrationService();
        }
        return AgentOrchestrationService.instance;
    }
    // ===== CORE AGENTIC METHODS =====
    /**
     * Main entry point - วิเคราะห์และ execute task แบบ agentic
     */
    async processAgenticTask(userInput, context, constraints = {}) {
        const taskId = (0, uuid_1.v4)();
        const startTime = perf_hooks_1.performance.now();
        try {
            // 1. Intelligent Task Analysis
            const task = await this.analyzeUserIntent(userInput, context, constraints);
            this.activeTasks.set(taskId, { ...task, id: taskId });
            console.log(`🤖 Agentic Task Analysis: ${task.type} | Intent: ${task.intent.primary}`);
            // 2. Adaptive Planning
            const plan = await this.createExecutionPlan(task);
            this.executionPlans.set(taskId, plan);
            console.log(`📋 Execution Plan: ${plan.steps.length} steps, ${plan.estimatedDuration}ms estimated`);
            // 3. Multi-Step Execution
            const result = await this.executeAdaptivePlan(plan, task);
            // 4. Response Enhancement
            const enhancedResponse = await this.enhanceResponse(result, task);
            // 5. Performance Analysis
            const performanceMetrics = this.calculatePerformanceMetrics(startTime, plan, result);
            this.performanceHistory.push(performanceMetrics);
            // 6. Emit real-time updates
            this.emitTaskCompletion(taskId, enhancedResponse, performanceMetrics);
            return {
                id: (0, uuid_1.v4)(),
                taskId,
                success: true,
                content: enhancedResponse.content,
                metadata: enhancedResponse.metadata,
                toolExecutions: enhancedResponse.toolExecutions,
                performance: performanceMetrics,
                recommendations: enhancedResponse.recommendations
            };
        }
        catch (error) {
            console.error(`❌ Agentic task failed: ${error}`);
            return {
                id: (0, uuid_1.v4)(),
                taskId,
                success: false,
                content: `I encountered an error while processing your request: ${error.message}`,
                metadata: {
                    confidence: 0,
                    completeness: 0,
                    accuracy: 0,
                    relevance: 0,
                    sources: [],
                    reasoning: ['Error during task execution'],
                    limitations: ['Task execution failed']
                },
                toolExecutions: [],
                performance: this.calculatePerformanceMetrics(startTime, null, null)
            };
        }
        finally {
            // Cleanup
            this.activeTasks.delete(taskId);
            this.executionPlans.delete(taskId);
        }
    }
    /**
     * Intelligent Intent Analysis - คล้าย Claude Code ที่วิเคราะห์ user intent
     */
    async analyzeUserIntent(userInput, context, constraints) {
        // Analyze complexity and domain
        const complexity = this.determineComplexity(userInput, context);
        const domain = this.determineDomain(userInput, context);
        const taskType = this.determineTaskType(userInput, complexity);
        // Extract intent
        const intent = {
            primary: this.extractPrimaryIntent(userInput),
            secondary: this.extractSecondaryIntents(userInput),
            domain,
            complexity,
            urgency: this.determineUrgency(userInput, context)
        };
        // Set constraints with defaults
        const taskConstraints = {
            maxExecutionTime: constraints.maxExecutionTime || 30000,
            maxTokens: constraints.maxTokens || 4000,
            outputFormat: constraints.outputFormat || 'markdown',
            quality: constraints.quality || 'balanced',
            ...constraints
        };
        // Determine expected outputs
        const expectedOutputs = this.determineExpectedOutputs(userInput, intent);
        return {
            id: '', // Will be set by caller
            type: taskType,
            intent,
            context,
            priority: this.mapUrgencyToPriority(intent.urgency),
            constraints: taskConstraints,
            expectedOutputs
        };
    }
    /**
     * Adaptive Planning - สร้าง execution plan แบบ dynamic
     */
    async createExecutionPlan(task) {
        const planId = (0, uuid_1.v4)();
        const steps = [];
        const dependencies = [];
        // 1. Memory Context Retrieval (always first)
        if (task.context.sessionId) {
            steps.push({
                id: 'memory_context',
                type: 'retrieval',
                operation: 'retrieve_conversation_context',
                inputs: { sessionId: task.context.sessionId, query: task.intent.primary },
                expectedOutputs: { context: 'array', relevantMemories: 'array' },
                tools: ['memory_search'],
                parallel: false,
                optional: false,
                timeout: 5000
            });
        }
        // 2. Knowledge Base Search (if relevant collections)
        if (task.context.collectionNames.length > 0) {
            const searchStep = {
                id: 'knowledge_search',
                type: 'retrieval',
                operation: 'search_knowledge_base',
                inputs: {
                    query: task.intent.primary,
                    collections: task.context.collectionNames,
                    maxResults: task.intent.complexity === 'high' ? 10 : 5
                },
                expectedOutputs: { documents: 'array', sources: 'array' },
                tools: task.context.collectionNames.map(name => `search_${name}`),
                parallel: true,
                optional: false,
                timeout: 10000
            };
            steps.push(searchStep);
            if (steps.length > 1) {
                dependencies.push({
                    stepId: 'knowledge_search',
                    dependsOn: ['memory_context']
                });
            }
        }
        // 3. Web Search (for current information)
        if (this.shouldIncludeWebSearch(task)) {
            steps.push({
                id: 'web_search',
                type: 'retrieval',
                operation: 'web_search',
                inputs: { query: task.intent.primary, maxResults: 5 },
                expectedOutputs: { results: 'array', urls: 'array' },
                tools: ['web_search'],
                parallel: true,
                optional: true,
                timeout: 15000
            });
        }
        // 4. Core Analysis/Generation
        steps.push({
            id: 'core_processing',
            type: 'generation',
            operation: 'generate_response',
            inputs: {
                task: task.intent.primary,
                context: 'from_previous_steps',
                constraints: task.constraints
            },
            expectedOutputs: { response: 'string', reasoning: 'array' },
            tools: [],
            parallel: false,
            optional: false,
            timeout: task.constraints.maxExecutionTime * 0.6
        });
        // Add dependencies for core processing
        const prevStepIds = steps.slice(0, -1).map(s => s.id);
        if (prevStepIds.length > 0) {
            dependencies.push({
                stepId: 'core_processing',
                dependsOn: prevStepIds
            });
        }
        // 5. Response Enhancement
        steps.push({
            id: 'response_enhancement',
            type: 'validation',
            operation: 'enhance_response',
            inputs: { response: 'from_core_processing', task },
            expectedOutputs: { enhancedResponse: 'string', metadata: 'object' },
            tools: [],
            parallel: false,
            optional: true,
            timeout: 5000
        });
        dependencies.push({
            stepId: 'response_enhancement',
            dependsOn: ['core_processing']
        });
        // 6. Memory Update
        steps.push({
            id: 'memory_update',
            type: 'tool_execution',
            operation: 'update_memory',
            inputs: { sessionId: task.context.sessionId, interaction: 'full_conversation' },
            expectedOutputs: { updated: 'boolean' },
            tools: ['memory_embed'],
            parallel: true,
            optional: true,
            timeout: 3000
        });
        return {
            id: planId,
            taskId: task.id,
            steps,
            dependencies,
            estimatedDuration: this.estimatePlanDuration(steps),
            resourceRequirements: this.calculateResourceRequirements(steps),
            fallbackStrategies: this.createFallbackStrategies(task, steps)
        };
    }
    /**
     * Execute plan แบบ parallel/sequential ตาม dependencies
     */
    async executeAdaptivePlan(plan, task) {
        const results = new Map();
        const executedSteps = new Set();
        const parallelBatches = [];
        // Group steps by dependency levels
        const dependencyLevels = this.calculateDependencyLevels(plan.steps, plan.dependencies);
        for (const level of dependencyLevels) {
            const parallelSteps = level.filter(step => step.parallel);
            const sequentialSteps = level.filter(step => !step.parallel);
            // Execute parallel steps in batch
            if (parallelSteps.length > 0) {
                const parallelResults = await Promise.allSettled(parallelSteps.map(step => this.executeStep(step, results, task)));
                parallelSteps.forEach((step, index) => {
                    const result = parallelResults[index];
                    if (result.status === 'fulfilled') {
                        results.set(step.id, result.value);
                        executedSteps.add(step.id);
                    }
                    else if (!step.optional) {
                        throw new Error(`Required step ${step.id} failed: ${result.reason}`);
                    }
                });
            }
            // Execute sequential steps one by one
            for (const step of sequentialSteps) {
                try {
                    const result = await this.executeStep(step, results, task);
                    results.set(step.id, result);
                    executedSteps.add(step.id);
                }
                catch (error) {
                    if (!step.optional) {
                        throw new Error(`Required step ${step.id} failed: ${error}`);
                    }
                }
            }
        }
        return results;
    }
    /**
     * Execute individual step with appropriate tools
     */
    async executeStep(step, previousResults, task) {
        console.log(`🔧 Executing step: ${step.id} (${step.type})`);
        const startTime = perf_hooks_1.performance.now();
        try {
            switch (step.type) {
                case 'retrieval':
                    return await this.executeRetrievalStep(step, previousResults, task);
                case 'generation':
                    return await this.executeGenerationStep(step, previousResults, task);
                case 'tool_execution':
                    return await this.executeToolStep(step, previousResults, task);
                case 'validation':
                    return await this.executeValidationStep(step, previousResults, task);
                case 'analysis':
                    return await this.executeAnalysisStep(step, previousResults, task);
                default:
                    throw new Error(`Unknown step type: ${step.type}`);
            }
        }
        catch (error) {
            const duration = perf_hooks_1.performance.now() - startTime;
            console.error(`❌ Step ${step.id} failed after ${duration.toFixed(2)}ms: ${error}`);
            throw error;
        }
    }
    async executeRetrievalStep(step, previousResults, task) {
        switch (step.operation) {
            case 'retrieve_conversation_context':
                const context = await memoryService_1.memoryService.getConversationContext(step.inputs.sessionId, step.inputs.query);
                const relevantMemories = await memoryService_1.memoryService.searchMemory(step.inputs.sessionId, step.inputs.query, 5);
                return { context, relevantMemories };
            case 'search_knowledge_base':
                // This would integrate with existing collection search tools
                const searchResults = [];
                for (const toolName of step.tools) {
                    try {
                        // Simulate collection search - would integrate with actual tools
                        const result = { documents: [], sources: [] };
                        searchResults.push(result);
                    }
                    catch (error) {
                        console.warn(`Search tool ${toolName} failed: ${error}`);
                    }
                }
                return { results: searchResults };
            case 'web_search':
                // Would integrate with existing web search tool
                return { results: [], urls: [] };
            default:
                throw new Error(`Unknown retrieval operation: ${step.operation}`);
        }
    }
    async executeGenerationStep(step, previousResults, task) {
        // Collect context from previous steps
        const contextData = this.collectContextData(previousResults);
        // Create execution request for agent
        const executionRequest = {
            id: (0, uuid_1.v4)(),
            chatId: task.context.sessionId,
            userId: task.context.userId,
            agentId: task.context.agentId,
            prompt: this.buildPromptFromContext(task, contextData),
            context: {
                ...task.context,
                collectedData: contextData,
                constraints: task.constraints
            },
            priority: task.priority,
            timeout: step.timeout,
            createdAt: new Date()
        };
        // Execute through existing agent execution service
        const result = await agentExecutionService_1.agentExecutionService.executeAgent(executionRequest);
        return {
            response: result.result || '',
            reasoning: ['Generated using agent execution service'],
            metadata: result.metrics
        };
    }
    async executeToolStep(step, previousResults, task) {
        // Tool executions would integrate with existing toolRegistry
        switch (step.operation) {
            case 'update_memory':
                if (step.inputs.sessionId) {
                    await memoryService_1.memoryService.addMessage(step.inputs.sessionId, {
                        role: 'assistant',
                        content: 'Conversation processed',
                        timestamp: new Date().toISOString()
                    });
                }
                return { updated: true };
            default:
                return { completed: true };
        }
    }
    async executeValidationStep(step, previousResults, task) {
        const coreResult = previousResults.get('core_processing');
        if (!coreResult) {
            throw new Error('No core processing result to enhance');
        }
        // Enhance response with metadata
        const metadata = {
            confidence: this.calculateConfidence(coreResult, task),
            completeness: this.calculateCompleteness(coreResult, task),
            accuracy: 0.85, // Would be calculated based on fact-checking
            relevance: this.calculateRelevance(coreResult, task),
            sources: this.extractSources(previousResults),
            reasoning: this.extractReasoning(previousResults),
            limitations: this.identifyLimitations(coreResult, task)
        };
        return {
            enhancedResponse: coreResult.response,
            metadata
        };
    }
    async executeAnalysisStep(step, previousResults, task) {
        // Analysis steps for complex reasoning
        return { analysis: 'completed' };
    }
    // ===== HELPER METHODS =====
    setupEventHandlers() {
        // Listen to agent execution events
        agentExecutionService_1.agentExecutionService.on('execution_event', (event) => {
            this.emit('agentic_event', {
                type: 'tool_execution',
                data: event
            });
        });
    }
    determineComplexity(userInput, context) {
        const indicators = {
            high: ['analyze', 'compare', 'evaluate', 'research', 'comprehensive'],
            medium: ['explain', 'summarize', 'describe', 'how'],
            low: ['what', 'when', 'where', 'simple']
        };
        const input = userInput.toLowerCase();
        if (indicators.high.some(word => input.includes(word)))
            return 'high';
        if (indicators.medium.some(word => input.includes(word)))
            return 'medium';
        return 'low';
    }
    determineDomain(userInput, context) {
        const input = userInput.toLowerCase();
        if (context.collectionNames.some(name => name.includes('academic')))
            return 'academic';
        if (input.includes('code') || input.includes('technical'))
            return 'technical';
        if (input.includes('research') || input.includes('study'))
            return 'research';
        if (input.includes('create') || input.includes('design'))
            return 'creative';
        return 'general';
    }
    determineTaskType(userInput, complexity) {
        const input = userInput.toLowerCase();
        if (complexity === 'high') {
            if (input.includes('research'))
                return 'research';
            if (input.includes('analyze') || input.includes('compare'))
                return 'analytical';
            if (input.includes('create') || input.includes('design'))
                return 'creative';
            return 'complex';
        }
        return 'simple';
    }
    extractPrimaryIntent(userInput) {
        // Extract the main intent from user input
        return userInput.trim();
    }
    extractSecondaryIntents(userInput) {
        // Extract secondary intents
        return [];
    }
    determineUrgency(userInput, context) {
        const urgentWords = ['urgent', 'asap', 'immediately', 'critical', 'emergency'];
        const input = userInput.toLowerCase();
        if (urgentWords.some(word => input.includes(word)))
            return 'critical';
        return 'normal';
    }
    mapUrgencyToPriority(urgency) {
        switch (urgency) {
            case 'critical': return TaskPriority.CRITICAL;
            case 'high': return TaskPriority.HIGH;
            case 'normal': return TaskPriority.NORMAL;
            default: return TaskPriority.LOW;
        }
    }
    determineExpectedOutputs(userInput, intent) {
        return [{
                type: 'answer',
                format: 'markdown',
                confidence: 0.8
            }];
    }
    shouldIncludeWebSearch(task) {
        const recentWords = ['latest', 'current', 'recent', 'today', 'news'];
        return recentWords.some(word => task.intent.primary.toLowerCase().includes(word));
    }
    estimatePlanDuration(steps) {
        return steps.reduce((total, step) => total + step.timeout, 0);
    }
    calculateResourceRequirements(steps) {
        return [{
                type: 'memory',
                amount: steps.length * 100,
                priority: 'required'
            }];
    }
    createFallbackStrategies(task, steps) {
        return [{
                condition: 'timeout',
                alternativeSteps: [],
                degradedQuality: true
            }];
    }
    calculateDependencyLevels(steps, dependencies) {
        const levels = [];
        const stepMap = new Map(steps.map(step => [step.id, step]));
        const processed = new Set();
        while (processed.size < steps.length) {
            const currentLevel = [];
            for (const step of steps) {
                if (processed.has(step.id))
                    continue;
                const deps = dependencies.find(d => d.stepId === step.id);
                const canExecute = !deps || deps.dependsOn.every(depId => processed.has(depId));
                if (canExecute) {
                    currentLevel.push(step);
                    processed.add(step.id);
                }
            }
            if (currentLevel.length === 0) {
                throw new Error('Circular dependency detected in execution plan');
            }
            levels.push(currentLevel);
        }
        return levels;
    }
    collectContextData(previousResults) {
        const contextData = {};
        for (const [stepId, result] of previousResults.entries()) {
            contextData[stepId] = result;
        }
        return contextData;
    }
    buildPromptFromContext(task, contextData) {
        let prompt = `Task: ${task.intent.primary}\n\n`;
        if (contextData.memory_context) {
            prompt += `Context: ${JSON.stringify(contextData.memory_context.context)}\n\n`;
        }
        if (contextData.knowledge_search) {
            prompt += `Knowledge Base Results: Available\n\n`;
        }
        prompt += `Please provide a comprehensive response based on the available context.`;
        return prompt;
    }
    async enhanceResponse(result, task) {
        const coreResult = result.get('core_processing');
        const enhancementResult = result.get('response_enhancement');
        return {
            content: enhancementResult?.enhancedResponse || coreResult?.response || '',
            metadata: enhancementResult?.metadata || {},
            toolExecutions: this.summarizeToolExecutions(result),
            recommendations: this.generateRecommendations(task, result)
        };
    }
    summarizeToolExecutions(results) {
        const summaries = [];
        for (const [stepId, result] of results.entries()) {
            if (result.metadata) {
                summaries.push({
                    toolName: stepId,
                    duration: result.metadata.duration || 0,
                    success: true,
                    inputSize: 0,
                    outputSize: JSON.stringify(result).length,
                    relevanceScore: 0.8
                });
            }
        }
        return summaries;
    }
    generateRecommendations(task, results) {
        const recommendations = [];
        if (task.intent.complexity === 'high') {
            recommendations.push('Consider breaking down complex topics into smaller questions for more detailed analysis');
        }
        if (task.context.collectionNames.length === 0) {
            recommendations.push('Upload relevant documents to get more specific and accurate answers');
        }
        return recommendations;
    }
    calculatePerformanceMetrics(startTime, plan, results) {
        const endTime = perf_hooks_1.performance.now();
        return {
            totalDuration: endTime - startTime,
            planningTime: 100, // Would track actual planning time
            executionTime: endTime - startTime - 100,
            validationTime: 50,
            tokensUsed: 0, // Would aggregate from results
            toolsExecuted: results?.size || 0,
            memoryAccessed: 1
        };
    }
    calculateConfidence(result, task) {
        // Calculate confidence based on available data and complexity
        return 0.85;
    }
    calculateCompleteness(result, task) {
        return 0.9;
    }
    calculateRelevance(result, task) {
        return 0.9;
    }
    extractSources(results) {
        const sources = [];
        for (const [stepId, result] of results.entries()) {
            if (result.sources) {
                sources.push(...result.sources);
            }
        }
        return [...new Set(sources)];
    }
    extractReasoning(results) {
        const reasoning = [];
        for (const [stepId, result] of results.entries()) {
            if (result.reasoning) {
                reasoning.push(...result.reasoning);
            }
        }
        return reasoning;
    }
    identifyLimitations(result, task) {
        const limitations = [];
        if (task.context.collectionNames.length === 0) {
            limitations.push('Limited to general knowledge without access to specific documents');
        }
        return limitations;
    }
    emitTaskCompletion(taskId, response, metrics) {
        this.emit('task_completed', {
            taskId,
            response,
            metrics,
            timestamp: new Date()
        });
    }
    // ===== PUBLIC API =====
    getActiveTasksCount() {
        return this.activeTasks.size;
    }
    getPerformanceHistory() {
        return this.performanceHistory.slice(-100); // Last 100 tasks
    }
    getAverageExecutionTime() {
        if (this.performanceHistory.length === 0)
            return 0;
        const total = this.performanceHistory.reduce((sum, metrics) => sum + metrics.totalDuration, 0);
        return total / this.performanceHistory.length;
    }
}
exports.AgentOrchestrationService = AgentOrchestrationService;
// Export singleton instance
exports.agentOrchestrationService = AgentOrchestrationService.getInstance();
//# sourceMappingURL=agentOrchestrationService.js.map