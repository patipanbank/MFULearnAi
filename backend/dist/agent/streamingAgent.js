"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamingAgent = void 0;
const bedrock_1 = require("@langchain/community/chat_models/bedrock");
const prompts_1 = require("@langchain/core/prompts");
const messages_1 = require("@langchain/core/messages");
const tools_1 = require("@langchain/core/tools");
const agents_1 = require("langchain/agents");
const memory_1 = require("langchain/vectorstores/memory");
const bedrock_2 = require("@langchain/community/embeddings/bedrock");
const retrievers_1 = require("@langchain/core/retrievers");
const toolRegistry_1 = require("../services/toolRegistry");
const chromaService_1 = require("../services/chromaService");
class StreamingAgent {
    constructor(config) {
        this.tools = [];
        this.memoryStore = null;
        this.agentExecutor = null;
        this.config = config;
        this.llm = new bedrock_1.BedrockChat({
            region: process.env.AWS_REGION,
            model: config.modelId,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
            maxTokens: config.maxTokens,
            temperature: config.temperature,
        });
    }
    async initialize() {
        await this.setupTools();
        await this.setupMemory();
        await this.createAgent();
    }
    async setupTools() {
        const staticTools = [
            new tools_1.DynamicTool({
                name: "calculator",
                description: "Perform mathematical calculations",
                func: async (input) => {
                    return toolRegistry_1.toolRegistry.calculator(input, this.config.sessionId);
                },
            }),
            new tools_1.DynamicTool({
                name: "current_date",
                description: "Get the current date and time",
                func: async (input) => {
                    return toolRegistry_1.toolRegistry.current_date(input, this.config.sessionId);
                },
            }),
            new tools_1.DynamicTool({
                name: "web_search",
                description: "Search the web for current information",
                func: async (input) => {
                    return toolRegistry_1.toolRegistry.web_search(input, this.config.sessionId);
                },
            }),
        ];
        const memoryTools = [
            new tools_1.DynamicTool({
                name: "memory_search",
                description: "Search through chat memory for relevant context",
                func: async (input) => {
                    return toolRegistry_1.toolRegistry.memory_search(input, this.config.sessionId);
                },
            }),
            new tools_1.DynamicTool({
                name: "memory_embed",
                description: "Embed new message into chat memory",
                func: async (input) => {
                    return toolRegistry_1.toolRegistry.memory_embed(input, this.config.sessionId);
                },
            }),
        ];
        const knowledgeTools = [];
        for (const collectionName of this.config.collectionNames) {
            try {
                const retriever = await this.createCollectionRetriever(collectionName);
                if (retriever) {
                    knowledgeTools.push(new tools_1.DynamicTool({
                        name: `knowledge_${collectionName}`,
                        description: `Search knowledge base: ${collectionName}`,
                        func: async (input) => {
                            const docs = await retriever.getRelevantDocuments(input);
                            return docs.map((doc) => doc.pageContent).join('\n\n');
                        },
                    }));
                }
            }
            catch (error) {
                console.warn(`Failed to create retriever for collection ${collectionName}:`, error);
            }
        }
        this.tools = [...staticTools, ...memoryTools, ...knowledgeTools];
    }
    async createCollectionRetriever(collectionName) {
        try {
            return new retrievers_1.BaseRetriever({
                getRelevantDocuments: async (query) => {
                    const embeddings = new bedrock_2.BedrockEmbeddings({
                        region: process.env.AWS_REGION,
                        credentials: {
                            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                        },
                    });
                    const queryEmbedding = await embeddings.embedQuery(query);
                    const result = await chromaService_1.chromaService.queryCollection(collectionName, [queryEmbedding], 5);
                    if (result && result.documents && result.documents.length > 0) {
                        return result.documents.map((doc) => ({
                            pageContent: doc.document,
                            metadata: { source: collectionName, id: doc.id }
                        }));
                    }
                    return [];
                }
            });
        }
        catch (error) {
            console.error(`Error creating retriever for ${collectionName}:`, error);
            return null;
        }
    }
    async setupMemory() {
        try {
            const embeddings = new bedrock_2.BedrockEmbeddings({
                region: process.env.AWS_REGION,
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                },
            });
            this.memoryStore = new memory_1.MemoryVectorStore(embeddings);
        }
        catch (error) {
            console.error("Error setting up memory store:", error);
        }
    }
    async createAgent() {
        const prompt = prompts_1.ChatPromptTemplate.fromMessages([
            ["system", this.config.systemPrompt],
            new prompts_1.MessagesPlaceholder("chat_history"),
            ["human", "{input}"],
            new prompts_1.MessagesPlaceholder("agent_scratchpad"),
        ]);
        const agent = await (0, agents_1.createOpenAIFunctionsAgent)({
            llm: this.llm,
            tools: this.tools,
            prompt,
        });
        this.agentExecutor = new agents_1.AgentExecutor({
            agent,
            tools: this.tools,
            maxIterations: 5,
        });
    }
    async processMessageStream(messages, onEvent) {
        if (!this.agentExecutor) {
            throw new Error("Agent not initialized");
        }
        try {
            const userMessage = messages[messages.length - 1];
            if (!(userMessage instanceof messages_1.HumanMessage)) {
                throw new Error("Last message must be from human");
            }
            if (this.memoryStore) {
                const content = typeof userMessage.content === 'string'
                    ? userMessage.content
                    : JSON.stringify(userMessage.content);
                await this.memoryStore.addDocuments([{
                        pageContent: content,
                        metadata: { type: "user", timestamp: new Date().toISOString() }
                    }]);
            }
            const input = typeof userMessage.content === 'string'
                ? userMessage.content
                : JSON.stringify(userMessage.content);
            const result = await this.agentExecutor.invoke({
                input,
                chat_history: this.formatChatHistory(messages.slice(0, -1))
            });
            if (this.memoryStore && result.output) {
                await this.memoryStore.addDocuments([{
                        pageContent: result.output,
                        metadata: { type: "assistant", timestamp: new Date().toISOString() }
                    }]);
            }
            onEvent({
                type: "response",
                data: { content: result.output || "No response generated" }
            });
        }
        catch (error) {
            console.error("Error processing message:", error);
            onEvent({
                type: "error",
                data: { error: error instanceof Error ? error.message : 'Unknown error' }
            });
        }
    }
    formatChatHistory(messages) {
        return messages.map(msg => {
            if (msg instanceof messages_1.HumanMessage) {
                const content = typeof msg.content === 'string'
                    ? msg.content
                    : JSON.stringify(msg.content);
                return new messages_1.HumanMessage(content);
            }
            else if (msg instanceof messages_1.AIMessage) {
                const content = typeof msg.content === 'string'
                    ? msg.content
                    : JSON.stringify(msg.content);
                return new messages_1.AIMessage(content);
            }
            return msg;
        });
    }
    async addToMemory(content, metadata) {
        if (this.memoryStore) {
            await this.memoryStore.addDocuments([{
                    pageContent: content,
                    metadata: { ...metadata, timestamp: new Date().toISOString() }
                }]);
        }
    }
    async searchMemory(query, k = 5) {
        if (!this.memoryStore) {
            return [];
        }
        try {
            const docs = await this.memoryStore.similaritySearch(query, k);
            return docs;
        }
        catch (error) {
            console.error("Error searching memory:", error);
            return [];
        }
    }
    getTools() {
        return this.tools;
    }
}
exports.StreamingAgent = StreamingAgent;
//# sourceMappingURL=streamingAgent.js.map