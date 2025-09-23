"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationToolManager = void 0;
const types_1 = require("../types");
const unifiedToolRegistry_1 = require("../../services/unifiedToolRegistry");
const toolRegistry_1 = require("../../agent/toolRegistry");
class ConversationToolManager {
    constructor() {
        this.TOOL_TIMEOUT = 30000;
        this.MAX_CONCURRENT_TOOLS = 3;
        console.log('🔧 ConversationToolManager initialized');
    }
    async shouldUseTools(userMessage, enabledTools, memoryContext) {
        const toolKeywords = [
            'search', 'find', 'look up', 'calculate', 'compute',
            'what time', 'current date', 'remember', 'recall',
            'save', 'store', 'search in', 'from documents'
        ];
        const messageText = userMessage.toLowerCase();
        const hasToolKeyword = toolKeywords.some(keyword => messageText.includes(keyword));
        const hasCollectionReference = enabledTools.some(tool => tool.startsWith('search_') && messageText.includes('document'));
        const hasMath = /\d+\s*[+\-*/]\s*\d+/.test(messageText);
        return hasToolKeyword || hasCollectionReference || hasMath;
    }
    async executeTools(userMessage, enabledTools, context, onEvent) {
        console.log(`🔧 Executing tools for message: ${userMessage.substring(0, 50)}...`);
        const toolsToExecute = this.selectToolsToExecute(userMessage, enabledTools);
        if (toolsToExecute.length === 0) {
            return [];
        }
        const executions = [];
        const semaphore = new Array(Math.min(this.MAX_CONCURRENT_TOOLS, toolsToExecute.length));
        await Promise.all(semaphore.map(async (_, index) => {
            while (index < toolsToExecute.length) {
                const toolName = toolsToExecute[index];
                index += semaphore.length;
                try {
                    const execution = await this.executeTool(toolName, userMessage, context, onEvent);
                    executions.push(execution);
                }
                catch (error) {
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
        }));
        return executions;
    }
    selectToolsToExecute(userMessage, enabledTools) {
        const messageText = userMessage.toLowerCase();
        const selectedTools = [];
        enabledTools.forEach(toolName => {
            if (this.shouldExecuteTool(toolName, messageText)) {
                selectedTools.push(toolName);
            }
        });
        return selectedTools.slice(0, 3);
    }
    shouldExecuteTool(toolName, messageText) {
        const toolPatterns = {
            'web_search': ['search', 'find', 'look up', 'what is', 'who is'],
            'calculator': ['calculate', 'compute', '+', '-', '*', '/', 'math'],
            'current_date': ['date', 'time', 'today', 'now', 'current'],
            'memory_search': ['remember', 'recall', 'what did', 'previous'],
        };
        if (toolName.startsWith('search_')) {
            return messageText.includes('document') || messageText.includes('search in');
        }
        const patterns = toolPatterns[toolName];
        return patterns ? patterns.some(pattern => messageText.includes(pattern)) : false;
    }
    async executeTool(toolName, userMessage, context, onEvent) {
        const executionId = this.generateExecutionId();
        const startTime = new Date();
        onEvent({
            type: types_1.StreamingEventType.TOOL_STARTED,
            data: {
                conversationId: context.conversationId,
                executionId,
                toolName,
                input: { query: userMessage }
            }
        });
        try {
            const toolFunction = this.getToolFunction(toolName);
            if (!toolFunction) {
                throw new Error(`Tool not found: ${toolName}`);
            }
            const toolInput = this.prepareToolInput(toolName, userMessage, context);
            const output = await Promise.race([
                toolFunction(toolInput),
                this.createTimeoutPromise(this.TOOL_TIMEOUT, `Tool ${toolName} timed out`)
            ]);
            const endTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();
            onEvent({
                type: types_1.StreamingEventType.TOOL_COMPLETED,
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
        }
        catch (error) {
            const endTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();
            onEvent({
                type: types_1.StreamingEventType.TOOL_FAILED,
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
    getToolFunction(toolName) {
        const unifiedTool = unifiedToolRegistry_1.unifiedToolRegistry.getTool?.(toolName);
        if (unifiedTool && typeof unifiedTool.execute === 'function') {
            return unifiedTool.execute.bind(unifiedTool);
        }
        const legacyTool = toolRegistry_1.toolRegistry[toolName];
        if (legacyTool && typeof legacyTool.func === 'function') {
            return legacyTool.func;
        }
        return null;
    }
    prepareToolInput(toolName, userMessage, context) {
        const baseInput = { query: userMessage };
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
    extractSearchQuery(message) {
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
    extractMathExpression(message) {
        const mathPattern = /([\d+\-*/\s().]+)/;
        const match = message.match(mathPattern);
        return match ? match[1].trim() : message;
    }
    createTimeoutPromise(ms, errorMessage) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(errorMessage)), ms);
        });
    }
    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    formatToolResultsForLLM(executions) {
        if (executions.length === 0) {
            return '';
        }
        const results = ['Tool execution results:'];
        executions.forEach(execution => {
            if (execution.status === 'completed' && execution.output) {
                results.push(`\n${execution.toolName}:`);
                results.push(this.formatToolOutput(execution.toolName, execution.output));
            }
            else if (execution.status === 'failed') {
                results.push(`\n${execution.toolName}: Failed - ${execution.error?.message || 'Unknown error'}`);
            }
        });
        return results.join('\n');
    }
    formatToolOutput(toolName, output) {
        if (typeof output === 'string') {
            return output;
        }
        if (typeof output === 'object') {
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
    formatWebSearchOutput(output) {
        if (output.results && Array.isArray(output.results)) {
            return output.results
                .slice(0, 3)
                .map((result) => `- ${result.title}: ${result.snippet}`)
                .join('\n');
        }
        return String(output);
    }
    cleanup() {
        console.log('🧹 ConversationToolManager cleaned up');
    }
}
exports.ConversationToolManager = ConversationToolManager;
//# sourceMappingURL=ToolManager.js.map