"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentState = void 0;
exports.createLangGraphAgent = createLangGraphAgent;
const langgraph_1 = require("@langchain/langgraph");
const langgraph_2 = require("@langchain/langgraph");
const aws_1 = require("@langchain/aws");
const openai_1 = require("@langchain/openai");
const messages_1 = require("@langchain/core/messages");
const axios_1 = __importDefault(require("axios"));
exports.AgentState = langgraph_1.Annotation.Root({
    ...langgraph_1.MessagesAnnotation.spec,
    userQuery: (0, langgraph_1.Annotation)(),
    collectionNames: (0, langgraph_1.Annotation)(),
    toolsUsed: (0, langgraph_1.Annotation)({
        value: (current, update) => [...current, ...update],
        default: () => []
    }),
    ragResults: (0, langgraph_1.Annotation)(),
    webResults: (0, langgraph_1.Annotation)(),
    finalAnswer: (0, langgraph_1.Annotation)(),
    metadata: (0, langgraph_1.Annotation)(),
    needsRag: (0, langgraph_1.Annotation)(),
    needsWeb: (0, langgraph_1.Annotation)()
});
function createLLM(modelId, config) {
    if (modelId.includes('anthropic') || modelId.includes('claude')) {
        return new aws_1.ChatBedrockConverse({
            model: modelId,
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 4000,
            region: process.env.AWS_REGION || 'us-east-1',
            streaming: true
        });
    }
    else if (modelId.includes('gpt') || modelId.includes('openai')) {
        return new openai_1.ChatOpenAI({
            modelName: modelId,
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 4000,
            openAIApiKey: process.env.OPENAI_API_KEY,
            streaming: true
        });
    }
    else {
        return new aws_1.ChatBedrockConverse({
            model: modelId,
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 4000,
            region: process.env.AWS_REGION || 'us-east-1',
            streaming: true
        });
    }
}
async function ragSearchTool(query, collections) {
    try {
        console.log(`🔍 RAG Search: query="${query}", collections=${collections.join(',')}`);
        if (collections.length === 0) {
            return JSON.stringify({ message: "No collections available for search" });
        }
        const results = await Promise.all(collections.map(async (collectionName) => {
            try {
                const response = await axios_1.default.post(`${process.env.RAG_SERVICE_URL || 'http://localhost:3004'}/api/chroma/search`, {
                    collectionName,
                    query,
                    nResults: 5
                }, { timeout: 10000 });
                return {
                    collection: collectionName,
                    documents: response.data.documents || [],
                    metadatas: response.data.metadatas || []
                };
            }
            catch (error) {
                console.error(`RAG search failed for ${collectionName}:`, error);
                return { collection: collectionName, documents: [], metadatas: [] };
            }
        }));
        const validResults = results.filter(r => r.documents.length > 0);
        if (validResults.length === 0) {
            return JSON.stringify({ message: "No relevant documents found" });
        }
        return JSON.stringify({
            results: validResults,
            totalDocuments: validResults.reduce((sum, r) => sum + r.documents.length, 0)
        });
    }
    catch (error) {
        console.error('RAG search error:', error);
        return JSON.stringify({ error: "RAG search failed" });
    }
}
async function webSearchTool(query) {
    try {
        console.log(`🌐 Web Search: query="${query}"`);
        return JSON.stringify({
            message: "Web search not yet implemented",
            query
        });
    }
    catch (error) {
        console.error('Web search error:', error);
        return JSON.stringify({ error: "Web search failed" });
    }
}
async function calculatorTool(expression) {
    try {
        console.log(`🧮 Calculator: expression="${expression}"`);
        const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
        const result = eval(sanitized);
        return JSON.stringify({ expression, result });
    }
    catch (error) {
        console.error('Calculator error:', error);
        return JSON.stringify({ error: "Invalid expression" });
    }
}
async function routerNode(state) {
    console.log('📍 Router Node: Analyzing user query...');
    const query = state.userQuery.toLowerCase();
    const needsRag = state.collectionNames.length > 0 &&
        (query.includes('document') || query.includes('course') ||
            query.includes('lecture') || query.includes('content'));
    const needsWeb = query.includes('latest') || query.includes('current') ||
        query.includes('recent') || query.includes('news') ||
        query.includes('today');
    console.log(`🔀 Route Decision: RAG=${needsRag}, Web=${needsWeb}`);
    return {
        needsRag,
        needsWeb,
        metadata: {
            ...state.metadata,
            reasoningSteps: [...state.metadata.reasoningSteps, 'Analyzed query and determined required tools']
        }
    };
}
async function ragNode(state, config) {
    console.log('📚 RAG Node: Searching knowledge base...');
    const results = await ragSearchTool(state.userQuery, state.collectionNames);
    const parsedResults = JSON.parse(results);
    return {
        ragResults: [parsedResults],
        toolsUsed: ['rag_search'],
        metadata: {
            ...state.metadata,
            sources: [...state.metadata.sources, ...state.collectionNames],
            reasoningSteps: [...state.metadata.reasoningSteps, 'Retrieved relevant documents from knowledge base']
        }
    };
}
async function webNode(state) {
    console.log('🌐 Web Node: Searching web...');
    const results = await webSearchTool(state.userQuery);
    const parsedResults = JSON.parse(results);
    return {
        webResults: [parsedResults],
        toolsUsed: ['web_search'],
        metadata: {
            ...state.metadata,
            reasoningSteps: [...state.metadata.reasoningSteps, 'Searched web for current information']
        }
    };
}
async function agentNode(state, config) {
    console.log('🤖 Agent Node: Processing with LLM...');
    const llm = createLLM(config.modelId, {
        temperature: config.temperature,
        maxTokens: config.maxTokens
    });
    let contextMessage = '';
    if (state.ragResults.length > 0) {
        contextMessage += '\n\n**Knowledge Base Context:**\n';
        for (const result of state.ragResults) {
            if (result.results) {
                for (const r of result.results) {
                    contextMessage += `\nFrom ${r.collection}:\n`;
                    r.documents.slice(0, 3).forEach((doc, idx) => {
                        contextMessage += `${idx + 1}. ${doc.substring(0, 200)}...\n`;
                    });
                }
            }
        }
    }
    if (state.webResults.length > 0) {
        contextMessage += '\n\n**Web Search Results:**\n';
        contextMessage += JSON.stringify(state.webResults, null, 2);
    }
    const messages = [
        new messages_1.SystemMessage(config.systemPrompt || "You are a helpful AI assistant. Use provided context to answer questions accurately."),
        ...state.messages,
        new messages_1.HumanMessage(`${state.userQuery}${contextMessage}`)
    ];
    const response = await llm.invoke(messages);
    return {
        messages: [response],
        finalAnswer: response.content.toString(),
        metadata: {
            ...state.metadata,
            reasoningSteps: [...state.metadata.reasoningSteps, 'Generated response using LLM'],
            confidence: 0.85
        }
    };
}
function shouldUseRag(state) {
    return state.needsRag ? 'rag' : 'agent';
}
function shouldUseWeb(state) {
    return state.needsWeb ? 'web' : 'agent';
}
async function createLangGraphAgent(config) {
    console.log(`🏗️ Building LangGraph StateGraph for session: ${config.sessionId}`);
    const workflow = new langgraph_1.StateGraph(exports.AgentState)
        .addNode('router', async (state) => routerNode(state))
        .addNode('rag', async (state) => ragNode(state, config))
        .addNode('web', async (state) => webNode(state))
        .addNode('agent', async (state) => agentNode(state, config))
        .addEdge(langgraph_1.START, 'router')
        .addConditionalEdges('router', shouldUseRag, {
        'rag': 'rag',
        'agent': 'agent'
    })
        .addConditionalEdges('router', shouldUseWeb, {
        'web': 'web',
        'agent': 'agent'
    })
        .addEdge('rag', 'agent')
        .addEdge('web', 'agent')
        .addEdge('agent', langgraph_1.END);
    const checkpointer = new langgraph_2.MemorySaver();
    const graph = workflow.compile({
        checkpointer
    });
    console.log('✅ LangGraph agent compiled successfully');
    return {
        graph,
        async run(userQuery, messages = [], onChunk) {
            console.log(`🚀 Running LangGraph agent with query: "${userQuery.substring(0, 50)}..."`);
            const initialState = {
                messages,
                userQuery,
                collectionNames: config.collectionNames || [],
                toolsUsed: [],
                ragResults: [],
                webResults: [],
                finalAnswer: "",
                needsRag: false,
                needsWeb: false,
                metadata: {
                    confidence: 0.8,
                    sources: [],
                    reasoningSteps: []
                }
            };
            const threadConfig = {
                configurable: {
                    thread_id: config.sessionId
                }
            };
            try {
                const stream = await graph.stream(initialState, {
                    ...threadConfig,
                    streamMode: "values"
                });
                let finalState = null;
                for await (const state of stream) {
                    finalState = state;
                    if (state.finalAnswer && onChunk) {
                        onChunk(state.finalAnswer);
                    }
                }
                return {
                    answer: finalState?.finalAnswer || "No response generated",
                    metadata: finalState?.metadata,
                    toolsUsed: finalState?.toolsUsed || []
                };
            }
            catch (error) {
                console.error('❌ LangGraph execution error:', error);
                throw error;
            }
        }
    };
}
//# sourceMappingURL=langgraphAgent.js.map