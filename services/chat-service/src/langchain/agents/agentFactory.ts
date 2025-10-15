import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatBedrockConverse } from "@langchain/aws";
import { ChatOpenAI } from "@langchain/openai";
import { DynamicTool } from "@langchain/core/tools";
import { toolRegistry } from "../tools/toolRegistry";
import config from "../../config/config";
import logger from "../../utils/logger";

/**
 * Agent Configuration
 */
export interface AgentConfig {
  chatId: string;
  userId: string;
  agentId?: string;
  modelId?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  collectionNames?: string[];
  allowedTools?: string[];
}

/**
 * Create LLM instance based on model ID
 */
function createLLM(modelId: string, options: { temperature: number; maxTokens: number }) {
  logger.info('🤖 Creating LLM instance', { modelId });

  // Check if it's an OpenAI model
  if (modelId.startsWith('gpt-')) {
    if (!config.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    return new ChatOpenAI({
      modelName: modelId,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      openAIApiKey: config.OPENAI_API_KEY,
      streaming: true,
    });
  }

  // Default to AWS Bedrock
  return new ChatBedrockConverse({
    model: modelId,
    region: config.AWS_REGION,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID!,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY!,
    },
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    streaming: true,
  });
}

/**
 * Create Agent Prompt Template
 */
function createAgentPrompt(systemPrompt: string): ChatPromptTemplate {
  return ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);
}

/**
 * Create Agent Executor
 * Main factory function for creating LangChain agents
 */
export async function createAgentExecutor(
  agentConfig: AgentConfig
): Promise<AgentExecutor> {
  logger.info('🏭 Creating agent executor', {
    chatId: agentConfig.chatId,
    agentId: agentConfig.agentId,
  });

  try {
    // Get agent configuration from agent service if agentId provided
    let modelId = agentConfig.modelId || config.BEDROCK_MODEL_ID;
    let systemPrompt = agentConfig.systemPrompt || "You are a helpful AI assistant. Use tools when appropriate to help answer questions.";
    let temperature = agentConfig.temperature ?? 0.7;
    let maxTokens = agentConfig.maxTokens || 4000;
    let collectionNames = agentConfig.collectionNames || [];
    let allowedTools = agentConfig.allowedTools;

    // TODO: Fetch agent config from agent-service if agentId provided
    if (agentConfig.agentId) {
      logger.info('📋 Fetching agent configuration from agent-service', {
        agentId: agentConfig.agentId,
      });

      // For now, use defaults
      // In production, fetch from agent-service via HTTP
    }

    // Create LLM
    const llm = createLLM(modelId, { temperature, maxTokens });

    // Get tools from registry
    const tools = await toolRegistry.getTools({
      userId: agentConfig.userId,
      chatId: agentConfig.chatId,
      collectionNames,
      allowedTools,
    });

    logger.info('🔧 Agent tools loaded', {
      toolCount: tools.length,
      toolNames: tools.map(t => t.name),
    });

    // Create prompt
    const prompt = createAgentPrompt(systemPrompt);

    // Create agent
    const agent = await createToolCallingAgent({
      llm,
      tools,
      prompt,
    });

    // Create executor
    const executor = AgentExecutor.fromAgentAndTools({
      agent,
      tools,
      verbose: config.APP_ENV === 'development',
      maxIterations: config.MAX_ITERATIONS,
      returnIntermediateSteps: true,
      handleParsingErrors: true,
    });

    logger.info('✅ Agent executor created successfully', {
      chatId: agentConfig.chatId,
      modelId,
      toolCount: tools.length,
    });

    return executor;

  } catch (error: any) {
    logger.error('❌ Failed to create agent executor', {
      chatId: agentConfig.chatId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
