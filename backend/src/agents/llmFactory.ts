import { ChatBedrock } from '@langchain/community/chat_models/bedrock';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Return a LangChain Chat LLM instance for the requested *model_id*.
 * 
 * This implementation uses Amazon Bedrock via ``@langchain/aws.ChatBedrock``.
 */
export function getLLM(
  modelId: string,
  streaming: boolean = true,
  temperature: number = 0.7,
  maxTokens: number = 4000
): BaseChatModel {
  const region = process.env.AWS_REGION || 'us-east-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured');
  }

  return new ChatBedrock({
    model: modelId,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    streaming,
    temperature,
    maxTokens,
  });
} 