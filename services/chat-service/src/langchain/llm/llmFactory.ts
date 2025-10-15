import { ChatBedrockConverse } from "@langchain/aws";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import config from "../../config/config";
import logger from "../../utils/logger";

/**
 * LLM Factory
 * Creates and configures LLM instances
 */

export interface LLMConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}

/**
 * Create AWS Bedrock LLM
 */
export function createBedrockLLM(
  modelId: string = config.BEDROCK_MODEL_ID,
  llmConfig?: LLMConfig
): BaseChatModel {
  logger.info('🤖 Creating Bedrock LLM', {
    modelId,
    region: config.AWS_REGION,
    temperature: llmConfig?.temperature || config.TEMPERATURE,
    maxTokens: llmConfig?.maxTokens || config.MAX_TOKENS,
  });

  const llm = new ChatBedrockConverse({
    model: modelId,
    region: config.AWS_REGION,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
    temperature: llmConfig?.temperature || config.TEMPERATURE,
    maxTokens: llmConfig?.maxTokens || config.MAX_TOKENS,
    topP: llmConfig?.topP,
    stopSequences: llmConfig?.stopSequences,
  });

  return llm;
}

/**
 * Create LLM based on model ID
 * Supports different providers (Bedrock, OpenAI, etc.)
 */
export function createLLM(
  modelId?: string,
  llmConfig?: LLMConfig
): BaseChatModel {
  const model = modelId || config.BEDROCK_MODEL_ID;

  // Check model provider
  if (model.startsWith('anthropic.') || model.startsWith('amazon.') || model.startsWith('meta.')) {
    return createBedrockLLM(model, llmConfig);
  }

  // Default to Bedrock
  logger.warn('Unknown model provider, defaulting to Bedrock', { modelId: model });
  return createBedrockLLM(model, llmConfig);
}
