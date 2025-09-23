"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModernAgentSystem = void 0;
exports.createModernAgent = createModernAgent;
const langgraph_1 = require("@langchain/langgraph");
const messages_1 = require("@langchain/core/messages");
const tools_1 = require("@langchain/core/tools");
const aws_1 = require("@langchain/aws");
const langgraph_2 = require("@langchain/langgraph");
const langmemService_1 = require("../services/langmemService");
const embeddingService_1 = require("../services/embeddingService");
const chromaService_1 = require("../services/chromaService");
class ModernAgentSystem {
    constructor(config) {
        this.tools = [];
        this.config = config;
        this.memory = new langgraph_2.MemorySaver();
        this.llm = new aws_1.ChatBedrockConverse({
            model: config.modelId,
            region: process.env.AWS_REGION || 'us-east-1',
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 4000,
            streaming: true
        });
        this.setupGraph();
        console.log(`🤖 Modern Agent System initialized for session ${config.sessionId}`);
    }
    setupGraph() {
        const graphState = {
            messages: {
                value: (prev, next) => [...prev, ...next],
                default: () => []
            },
            iteration: { default: () => 0 },
            finalAnswer: { default: () => undefined },
            toolResults: { default: () => ({}) },
            memoryContext: { default: () => undefined },
            currentTask: { default: () => undefined },
            sessionId: { default: () => this.config.sessionId },
            userId: { default: () => this.config.userId }
        };
        this.graph = new langgraph_1.StateGraph({ channels: graphState })
            .addNode('memory_retrieval', this.memoryRetrievalNode.bind(this))
            .addNode('reasoning', this.reasoningNode.bind(this))
            .addNode('tool_execution', this.toolExecutionNode.bind(this))
            .addNode('memory_update', this.memoryUpdateNode.bind(this))
            .addNode('finalize', this.finalizeNode.bind(this))
            .addEdge(langgraph_1.START, 'memory_retrieval')
            .addEdge('memory_retrieval', 'reasoning')
            .addConditionalEdges('reasoning', this.shouldUseTool.bind(this), {
            'use_tool': 'tool_execution',
            'finalize': 'memory_update'
        })
            .addEdge('tool_execution', 'reasoning')
            .addEdge('memory_update', 'finalize')
            .addEdge('finalize', langgraph_1.END);
        console.log('🔗 LangGraph workflow configured');
    }
    async memoryRetrievalNode(state) {
        console.log('🧠 Memory Retrieval Node');
        try {
            const lastUserMessage = state.messages
                .filter(msg => msg instanceof messages_1.HumanMessage)
                .pop();
            if (lastUserMessage) {
                const context = {
                    sessionId: state.sessionId,
                    userId: state.userId,
                    agentId: this.config.agentId,
                    namespace: 'conversation'
                };
                const relevantMemories = await langmemService_1.langmemService.searchMemories(lastUserMessage.content, context, { limit: 5 });
                const recentMessages = await langmemService_1.langmemService.getContextualMemories(context, { limit: 10 });
                return {
                    memoryContext: {
                        relevantMemories,
                        recentMessages,
                        context
                    }
                };
            }
        }
        catch (error) {
            console.error('❌ Memory retrieval failed:', error);
        }
        return { memoryContext: null };
    }
    async reasoningNode(state, onEvent) {
        console.log('🤖 Reasoning Node');
        let systemPrompt = this.config.systemPrompt;
        if (state.memoryContext) {
            systemPrompt += `\n\nConversation Context: ${JSON.stringify(state.memoryContext.recentMessages)}`;
            systemPrompt += `\nRelevant Memories: ${JSON.stringify(state.memoryContext.relevantMemories)}`;
        }
        if (Object.keys(state.toolResults).length > 0) {
            systemPrompt += `\n\nPrevious Tool Results: ${JSON.stringify(state.toolResults)}`;
        }
        if (this.tools.length > 0) {
            const toolDescriptions = this.tools.map(tool => `${tool.name}: ${tool.description}`).join(', ');
            systemPrompt += `\n\nAvailable Tools: ${toolDescriptions}`;
        }
        const messages = [
            new messages_1.SystemMessage(systemPrompt),
            ...state.messages
        ];
        let fullResponse = '';
        let hasToolCalls = false;
        try {
            const stream = await this.llm.stream(messages);
            for await (const chunk of stream) {
                const content = chunk.content?.toString() || '';
                if (content) {
                    fullResponse += content;
                    if (onEvent) {
                        onEvent({
                            type: 'chunk',
                            data: { delta: content }
                        });
                    }
                }
            }
            hasToolCalls = this.detectToolCalls(fullResponse);
            const aiMessage = new messages_1.AIMessage(fullResponse);
            if (!hasToolCalls) {
                return {
                    messages: [aiMessage],
                    finalAnswer: fullResponse,
                    iteration: state.iteration + 1
                };
            }
            else {
                const toolCalls = this.extractToolCalls(fullResponse);
                return {
                    messages: [aiMessage],
                    currentTask: JSON.stringify(toolCalls),
                    iteration: state.iteration + 1
                };
            }
        }
        catch (error) {
            console.error('❌ Reasoning failed:', error);
            throw error;
        }
    }
    async toolExecutionNode(state, onEvent) {
        console.log('🔧 Tool Execution Node');
        if (!state.currentTask) {
            return { toolResults: state.toolResults };
        }
        try {
            const toolCalls = JSON.parse(state.currentTask);
            const newResults = { ...state.toolResults };
            for (const toolCall of toolCalls) {
                const { name, input } = toolCall;
                if (onEvent) {
                    onEvent({
                        type: 'tool_start',
                        data: { tool_name: name, tool_input: input }
                    });
                }
                try {
                    const tool = this.tools.find(t => t.name === name);
                    if (!tool) {
                        throw new Error(`Tool ${name} not found`);
                    }
                    const result = await tool.func(input);
                    newResults[name] = result;
                    if (onEvent) {
                        onEvent({
                            type: 'tool_result',
                            data: { tool_name: name, output: result }
                        });
                    }
                }
                catch (error) {
                    const errorMessage = `Tool ${name} failed: ${error.message}`;
                    newResults[name] = errorMessage;
                    if (onEvent) {
                        onEvent({
                            type: 'tool_result',
                            data: { tool_name: name, output: errorMessage }
                        });
                    }
                }
            }
            return {
                toolResults: newResults,
                currentTask: undefined
            };
        }
        catch (error) {
            console.error('❌ Tool execution failed:', error);
            return { toolResults: state.toolResults };
        }
    }
    async memoryUpdateNode(state) {
        console.log('💾 Memory Update Node');
        try {
            const context = {
                sessionId: state.sessionId,
                userId: state.userId,
                agentId: this.config.agentId,
                namespace: 'conversation'
            };
            const recentMessages = state.messages.slice(-2).map(msg => ({
                role: msg instanceof messages_1.HumanMessage ? 'user' : 'assistant',
                content: msg.content,
                timestamp: new Date().toISOString()
            }));
            if (recentMessages.length > 0) {
                await langmemService_1.langmemService.processMessages(recentMessages, context);
            }
        }
        catch (error) {
            console.error('❌ Memory update failed:', error);
        }
        return {};
    }
    async finalizeNode(state, onEvent) {
        console.log('✅ Finalize Node');
        if (onEvent && state.finalAnswer) {
            onEvent({
                type: 'end',
                data: {
                    answer: state.finalAnswer,
                    inputTokens: 0,
                    outputTokens: 0,
                    iterations: state.iteration
                }
            });
        }
        return {};
    }
    shouldUseTool(state) {
        if (state.currentTask && state.iteration < (this.config.maxIterations || 5)) {
            return 'use_tool';
        }
        return 'finalize';
    }
    detectToolCalls(response) {
        const toolPatterns = [
            /search_.*?\(/i,
            /use.*?tool/i,
            /I need to/i,
            /Let me search/i
        ];
        return toolPatterns.some(pattern => pattern.test(response));
    }
    extractToolCalls(response) {
        const calls = [];
        for (const tool of this.tools) {
            const pattern = new RegExp(`${tool.name}\\s*\\(([^)]+)\\)`, 'i');
            const match = response.match(pattern);
            if (match) {
                calls.push({
                    name: tool.name,
                    input: match[1].trim().replace(/['"]/g, '')
                });
            }
        }
        return calls;
    }
    async setupKnowledgeTools() {
        console.log('📚 Setting up knowledge tools...');
        if (this.config.collectionNames && this.config.collectionNames.length > 0) {
            for (const collectionName of this.config.collectionNames) {
                const tool = new tools_1.DynamicTool({
                    name: `search_${collectionName}`,
                    description: `Search and retrieve information from the ${collectionName} knowledge base`,
                    func: async (input) => {
                        try {
                            const queryEmbedding = await embeddingService_1.embeddingService.embed(input);
                            if (!queryEmbedding || queryEmbedding.length === 0) {
                                return `Search in ${collectionName} is currently unavailable.`;
                            }
                            const collection = await chromaService_1.chromaService.getOrCreateCollection(collectionName);
                            const results = await collection.query({
                                queryEmbeddings: [queryEmbedding],
                                nResults: 5
                            });
                            if (!results.documents || results.documents[0].length === 0) {
                                return `No relevant information found in ${collectionName}.`;
                            }
                            return results.documents[0]
                                .filter(doc => doc && doc.trim())
                                .slice(0, 3)
                                .map((doc, idx) => `${idx + 1}. ${doc}`)
                                .join('\n\n');
                        }
                        catch (error) {
                            console.error(`❌ Search failed in ${collectionName}:`, error);
                            return `Search error in ${collectionName}: ${error.message}`;
                        }
                    }
                });
                this.tools.push(tool);
            }
        }
    }
    async setupMemoryTools() {
        console.log('🧠 Setting up memory tools...');
        const memoryTool = new tools_1.DynamicTool({
            name: 'search_conversation_memory',
            description: 'Search through conversation history to find relevant context',
            func: async (input) => {
                try {
                    const context = {
                        sessionId: this.config.sessionId,
                        userId: this.config.userId,
                        agentId: this.config.agentId,
                        namespace: 'conversation'
                    };
                    const memories = await langmemService_1.langmemService.searchMemories(input, context, { limit: 3 });
                    if (memories.length === 0) {
                        return 'No relevant conversation history found.';
                    }
                    return memories.map((memory, idx) => `${idx + 1}. ${memory.content}`).join('\n');
                }
                catch (error) {
                    return `Memory search failed: ${error.message}`;
                }
            }
        });
        this.tools.push(memoryTool);
    }
    async run(messages, onEvent) {
        console.log(`🚀 Modern Agent System running with ${messages.length} messages`);
        try {
            await this.setupKnowledgeTools();
            await this.setupMemoryTools();
            const initialState = {
                messages,
                iteration: 0,
                toolResults: {},
                sessionId: this.config.sessionId,
                userId: this.config.userId
            };
            const workflow = this.graph.compile({ checkpointer: this.memory });
            const result = await workflow.invoke(initialState, {
                configurable: { thread_id: this.config.sessionId },
                onEvent
            });
            return result.finalAnswer || 'No response generated';
        }
        catch (error) {
            console.error('❌ Modern Agent System execution failed:', error);
            if (onEvent) {
                onEvent({
                    type: 'error',
                    data: { error: error.message }
                });
            }
            throw error;
        }
    }
    getState() {
        return {
            sessionId: this.config.sessionId,
            toolCount: this.tools.length,
            modelId: this.config.modelId
        };
    }
    visualize() {
        return `Modern Agent System:
- Model: ${this.config.modelId}
- Session: ${this.config.sessionId}
- Tools: ${this.tools.length}
- Collections: ${this.config.collectionNames?.length || 0}
- Max Iterations: ${this.config.maxIterations || 5}`;
    }
}
exports.ModernAgentSystem = ModernAgentSystem;
async function createModernAgent(config) {
    console.log('🏭 Creating Modern Agent System...');
    const agent = new ModernAgentSystem(config);
    return {
        run: agent.run.bind(agent),
        getState: agent.getState.bind(agent),
        visualize: agent.visualize.bind(agent)
    };
}
//# sourceMappingURL=modernAgentSystem.js.map