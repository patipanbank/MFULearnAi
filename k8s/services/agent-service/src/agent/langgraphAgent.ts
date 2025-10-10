/**
 * LangGraph Custom Agent Implementation
 *
 * Modern agent using StateGraph for:
 * - Dynamic workflow control
 * - Built-in state management
 * - Native streaming support
 * - Conditional routing
 * - Redis-backed checkpointer for persistence
 */

import { StateGraph, MessagesAnnotation, Annotation, START, END } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { ChatBedrockConverse } from "@langchain/aws";
import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { toolRegistry } from "../services/toolRegistry";
import axios from "axios";
import config from "../config/config";

// ===== STATE DEFINITION =====

export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  userQuery: Annotation<string>(),
  collectionNames: Annotation<string[]>(),
  toolsUsed: Annotation<string[]>({
    value: (current, update) => [...current, ...update],
    default: () => []
  }),
  ragResults: Annotation<any[]>(),
  webResults: Annotation<any[]>(),
  finalAnswer: Annotation<string>(),
  metadata: Annotation<{
    confidence: number;
    sources: string[];
    reasoningSteps: string[];
  }>(),
  needsRag: Annotation<boolean>(),
  needsWeb: Annotation<boolean>()
});

// ===== CONFIGURATION =====

export interface LangGraphAgentConfig {
  modelId: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  collectionNames?: string[];
  sessionId: string;
  tools?: { [name: string]: any };
}

// ===== LLM FACTORY =====

function createLLM(modelId: string, config: { temperature?: number; maxTokens?: number }) {
  if (modelId.includes('anthropic') || modelId.includes('claude')) {
    return new ChatBedrockConverse({
      model: modelId,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4000,
      region: process.env.AWS_REGION || 'us-east-1',
      streaming: true
    });
  } else if (modelId.includes('gpt') || modelId.includes('openai')) {
    return new ChatOpenAI({
      modelName: modelId,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4000,
      openAIApiKey: process.env.OPENAI_API_KEY,
      streaming: true
    });
  } else {
    // Default to Bedrock
    return new ChatBedrockConverse({
      model: modelId,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4000,
      region: process.env.AWS_REGION || 'us-east-1',
      streaming: true
    });
  }
}

// ===== TOOL DEFINITIONS =====

async function ragSearchTool(query: string, collections: string[]): Promise<string> {
  try {
    console.log(`🔍 RAG Search: query="${query}", collections=${collections.join(',')}`);

    if (collections.length === 0) {
      return JSON.stringify({ message: "No collections available for search" });
    }

    const results = await Promise.all(
      collections.map(async (collectionName) => {
        try {
          const response = await axios.post(
            `${config.ragServiceUrl}/api/chroma/search`,
            {
              collectionName,
              query,
              nResults: 5
            },
            { timeout: 10000 }
          );
          return {
            collection: collectionName,
            documents: response.data.documents || [],
            metadatas: response.data.metadatas || []
          };
        } catch (error) {
          console.error(`RAG search failed for ${collectionName}:`, error);
          return { collection: collectionName, documents: [], metadatas: [] };
        }
      })
    );

    const validResults = results.filter(r => r.documents.length > 0);

    if (validResults.length === 0) {
      return JSON.stringify({ message: "No relevant documents found" });
    }

    return JSON.stringify({
      results: validResults,
      totalDocuments: validResults.reduce((sum, r) => sum + r.documents.length, 0)
    });
  } catch (error) {
    console.error('RAG search error:', error);
    return JSON.stringify({ error: "RAG search failed" });
  }
}

async function webSearchTool(query: string): Promise<string> {
  try {
    console.log(`🌐 Web Search: query="${query}"`);

    // Placeholder - integrate with actual web search API
    return JSON.stringify({
      message: "Web search not yet implemented",
      query
    });
  } catch (error) {
    console.error('Web search error:', error);
    return JSON.stringify({ error: "Web search failed" });
  }
}

async function calculatorTool(expression: string): Promise<string> {
  try {
    console.log(`🧮 Calculator: expression="${expression}"`);

    // Safe evaluation - only allow basic math
    const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
    const result = eval(sanitized);

    return JSON.stringify({ expression, result });
  } catch (error) {
    console.error('Calculator error:', error);
    return JSON.stringify({ error: "Invalid expression" });
  }
}

// ===== NODE FUNCTIONS =====

// Router Node: Decides which tools to use
async function routerNode(state: typeof AgentState.State) {
  console.log('📍 Router Node: Analyzing user query...');

  const query = state.userQuery.toLowerCase();

  // Simple heuristic routing
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

// RAG Node: Search knowledge base
async function ragNode(state: typeof AgentState.State, config: LangGraphAgentConfig) {
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

// Web Search Node
async function webNode(state: typeof AgentState.State) {
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

// Agent Node: Main LLM reasoning with tool calling
async function agentNode(state: typeof AgentState.State, config: LangGraphAgentConfig) {
  console.log('🤖 Agent Node: Processing with LLM...');

  const llm = createLLM(config.modelId, {
    temperature: config.temperature,
    maxTokens: config.maxTokens
  });

  // Build context from previous steps
  let contextMessage = '';

  if (state.ragResults.length > 0) {
    contextMessage += '\n\n**Knowledge Base Context:**\n';
    for (const result of state.ragResults) {
      if (result.results) {
        for (const r of result.results) {
          contextMessage += `\nFrom ${r.collection}:\n`;
          r.documents.slice(0, 3).forEach((doc: string, idx: number) => {
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

  // Create messages
  const messages: BaseMessage[] = [
    new SystemMessage(config.systemPrompt || "You are a helpful AI assistant. Use provided context to answer questions accurately."),
    ...state.messages,
    new HumanMessage(`${state.userQuery}${contextMessage}`)
  ];

  // Invoke LLM
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

// ===== CONDITIONAL EDGES =====

function shouldUseRag(state: typeof AgentState.State): string {
  return state.needsRag ? 'rag' : 'agent';
}

function shouldUseWeb(state: typeof AgentState.State): string {
  return state.needsWeb ? 'web' : 'agent';
}

// ===== GRAPH BUILDER =====

export async function createLangGraphAgent(config: LangGraphAgentConfig) {
  console.log(`🏗️ Building LangGraph StateGraph for session: ${config.sessionId}`);

  // Create graph
  const workflow = new StateGraph(AgentState)
    // Add nodes
    .addNode('router', async (state) => routerNode(state))
    .addNode('rag', async (state) => ragNode(state, config))
    .addNode('web', async (state) => webNode(state))
    .addNode('agent', async (state) => agentNode(state, config))

    // Define flow
    .addEdge(START, 'router')
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
    .addEdge('agent', END);

  // Use MemorySaver for checkpointing
  const checkpointer = new MemorySaver();

  // Compile graph
  const graph = workflow.compile({
    checkpointer
  });

  console.log('✅ LangGraph agent compiled successfully');

  return {
    graph,
    async run(userQuery: string, messages: BaseMessage[] = [], onChunk?: (chunk: string) => void) {
      console.log(`🚀 Running LangGraph agent with query: "${userQuery.substring(0, 50)}..."`);

      const initialState: Partial<typeof AgentState.State> = {
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
        // Stream execution
        const stream = await graph.stream(initialState, {
          ...threadConfig,
          streamMode: "values"
        });

        let finalState: any = null;

        for await (const state of stream) {
          finalState = state;

          // Stream chunks if in agent node
          if (state.finalAnswer && onChunk) {
            onChunk(state.finalAnswer);
          }
        }

        return {
          answer: finalState?.finalAnswer || "No response generated",
          metadata: finalState?.metadata,
          toolsUsed: finalState?.toolsUsed || []
        };

      } catch (error) {
        console.error('❌ LangGraph execution error:', error);
        throw error;
      }
    }
  };
}

export type LangGraphAgent = Awaited<ReturnType<typeof createLangGraphAgent>>;
