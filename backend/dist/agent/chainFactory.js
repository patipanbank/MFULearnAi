"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChainFactory = void 0;
const bedrock_1 = require("@langchain/community/chat_models/bedrock");
const prompts_1 = require("langchain/prompts");
const runnable_1 = require("langchain/schema/runnable");
const output_parser_1 = require("langchain/schema/output_parser");
const schema_1 = require("langchain/schema");
const bedrock_2 = require("@langchain/community/embeddings/bedrock");
const memory_1 = require("langchain/vectorstores/memory");
const chromaService_1 = require("../services/chromaService");
class ChainFactory {
    constructor(config) {
        this.memoryStore = null;
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
        await this.setupMemory();
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
    createSimpleChain() {
        const prompt = prompts_1.ChatPromptTemplate.fromMessages([
            ["system", this.config.systemPrompt],
            ["human", "{input}"],
        ]);
        return runnable_1.RunnableSequence.from([
            prompt,
            this.llm,
            new output_parser_1.StringOutputParser(),
        ]);
    }
    createConversationalChain() {
        const prompt = prompts_1.ChatPromptTemplate.fromMessages([
            ["system", this.config.systemPrompt],
            new prompts_1.MessagesPlaceholder("chat_history"),
            ["human", "{input}"],
        ]);
        return runnable_1.RunnableSequence.from([
            prompt,
            this.llm,
            new output_parser_1.StringOutputParser(),
        ]);
    }
    createRAGChain() {
        const prompt = prompts_1.ChatPromptTemplate.fromMessages([
            ["system", this.config.systemPrompt],
            ["system", "Use the following context to answer the question:\n{context}"],
            new prompts_1.MessagesPlaceholder("chat_history"),
            ["human", "{input}"],
        ]);
        return runnable_1.RunnableSequence.from([
            {
                input: (input) => input.input,
                chat_history: (input) => input.chat_history,
                context: async (input) => {
                    return await this.retrieveContext(input.input);
                },
            },
            prompt,
            this.llm,
            new output_parser_1.StringOutputParser(),
        ]);
    }
    async retrieveContext(query) {
        const contexts = [];
        if (this.memoryStore) {
            try {
                const memoryDocs = await this.memoryStore.similaritySearch(query, 3);
                contexts.push(...memoryDocs.map((doc) => doc.pageContent));
            }
            catch (error) {
                console.error("Error searching memory:", error);
            }
        }
        for (const collectionName of this.config.collectionNames) {
            try {
                const embeddings = new bedrock_2.BedrockEmbeddings({
                    region: process.env.AWS_REGION,
                    credentials: {
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    },
                });
                const queryEmbedding = await embeddings.embedQuery(query);
                const result = await chromaService_1.chromaService.queryCollection(collectionName, [queryEmbedding], 3);
                if (result && result.documents && result.documents.length > 0) {
                    contexts.push(...result.documents.map((doc) => doc.document));
                }
            }
            catch (error) {
                console.warn(`Error searching collection ${collectionName}:`, error);
            }
        }
        return contexts.join("\n\n");
    }
    async processMessage(messages, onEvent) {
        const chain = this.getChain();
        const userMessage = messages[messages.length - 1];
        if (userMessage instanceof schema_1.HumanMessage) {
            if (this.memoryStore) {
                await this.memoryStore.addDocuments([{
                        pageContent: userMessage.content,
                        metadata: { type: "user", timestamp: new Date().toISOString() }
                    }]);
            }
            const input = {
                input: userMessage.content,
                chat_history: this.formatChatHistory(messages.slice(0, -1))
            };
            const response = await chain.invoke(input);
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
    getChain() {
        switch (this.config.chainType) {
            case 'simple':
                return this.createSimpleChain();
            case 'conversational':
                return this.createConversationalChain();
            case 'rag':
                return this.createRAGChain();
            default:
                return this.createConversationalChain();
        }
    }
    formatChatHistory(messages) {
        return messages.map(msg => {
            if (msg instanceof schema_1.HumanMessage) {
                return new schema_1.HumanMessage(msg.content);
            }
            else if (msg instanceof schema_1.AIMessage) {
                return new schema_1.AIMessage(msg.content);
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
}
exports.ChainFactory = ChainFactory;
//# sourceMappingURL=chainFactory.js.map