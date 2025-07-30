"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LangChainAgent = void 0;
const bedrock_1 = require("@langchain/community/chat_models/bedrock");
const prompts_1 = require("langchain/prompts");
const schema_1 = require("langchain/schema");
const tools_1 = require("langchain/tools");
const agents_1 = require("langchain/agents");
const retriever_1 = require("langchain/tools/retriever");
const memory_1 = require("langchain/vectorstores/memory");
const bedrock_2 = require("@langchain/community/embeddings/bedrock");
const toolRegistry_1 = require("../services/toolRegistry");
const chromaService_1 = require("../services/chromaService");
class LangChainAgent {
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
            new tools_1.Tool({
                name: "calculator",
                description: "Perform mathematical calculations",
                func: async (input) => {
                    return toolRegistry_1.toolRegistry.calculator(input, this.config.sessionId);
                },
            }),
            new tools_1.Tool({
                name: "current_date",
                description: "Get the current date and time",
                func: async (input) => {
                    return toolRegistry_1.toolRegistry.current_date(input, this.config.sessionId);
                },
            }),
            new tools_1.Tool({
                name: "web_search",
                description: "Search the web for current information",
                func: async (input) => {
                    return toolRegistry_1.toolRegistry.web_search(input, this.config.sessionId);
                },
            }),
        ];
        const memoryTools = [
            new tools_1.Tool({
                name: "memory_search",
                description: "Search through chat memory for relevant context",
                func: async (input) => {
                    return toolRegistry_1.toolRegistry.memory_search(input, this.config.sessionId);
                },
            }),
            new tools_1.Tool({
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
                    knowledgeTools.push((0, retriever_1.createRetrieverTool)(retriever, {
                        name: `knowledge_${collectionName}`,
                        description: `Search knowledge base: ${collectionName}`,
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
            return {
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
            };
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
    async processMessage(messages, onEvent) {
        if (!this.agentExecutor) {
            throw new Error("Agent not initialized");
        }
        try {
            const userMessage = messages[messages.length - 1];
            if (userMessage instanceof schema_1.HumanMessage) {
                if (this.memoryStore) {
                    await this.memoryStore.addDocuments([{
                            pageContent: userMessage.content,
                            metadata: { type: "user", timestamp: new Date().toISOString() }
                        }]);
                }
                const result = await this.agentExecutor.invoke({
                    input: userMessage.content,
                    chat_history: messages.slice(0, -1),
                });
                const response = result.output;
                if (this.memoryStore) {
                    await this.memoryStore.addDocuments([{
                            pageContent: response,
                            metadata: { type: "assistant", timestamp: new Date().toISOString() }
                        }]);
                }
                return response;
            }
            return "Invalid message format";
        }
        catch (error) {
            console.error("Error processing message:", error);
            throw error;
        }
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
exports.LangChainAgent = LangChainAgent;
//# sourceMappingURL=langchainAgent.js.map