import { bedrockService } from './bedrock';
import { chatConfig } from '../config/chatConfig';
import { ChatMessage } from '../types/chat'; // Use ChatMessage from types
import { Source } from './ragService'; // Import Source type
import { SystemPrompt } from '../models/SystemPrompt'; // For potential direct use

// --- Interfaces/Types ---

// Type for the structure expected by Bedrock API
interface BedrockMessage {
  role: 'user' | 'assistant';
  content: Array<{ type: 'text', text: string } | { type: 'image', source: { type: string, media_type: string, data: string } }>;
}

// Type for retry configuration
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

// --- Utility Functions ---

/**
 * Basic sleep utility for retry delays.
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Bedrock Interaction Service Class ---

class BedrockInteractionService {
  private readonly retryConfig: RetryConfig = chatConfig.RETRY_CONFIG;

  /**
   * Retries an async operation with exponential backoff.
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt > this.retryConfig.maxRetries) {
        console.error(`Operation failed after ${this.retryConfig.maxRetries} retries:`, error);
        throw error; // Re-throw the final error
      }

      // Check for specific retryable errors (e.g., throttling)
      // Add specific error codes/messages from Bedrock if known
      const isRetryable = error.code === 'ThrottlingException' || error.message?.includes('throttled');

      if (!isRetryable) {
          console.error("Non-retryable error during Bedrock operation:", error);
          throw error; // Don't retry non-retryable errors
      }

      const delay = Math.min(
        this.retryConfig.baseDelay * Math.pow(2, attempt - 1) + Math.random() * 100, // Add jitter
        this.retryConfig.maxDelay
      );

      console.warn(`Bedrock operation failed (attempt ${attempt}/${this.retryConfig.maxRetries}). Retrying in ${delay}ms... Error: ${error.message}`);
      await sleep(delay);
      return this.retryOperation(operation, attempt + 1);
    }
  }

  /**
   * Summarizes older messages to conserve tokens, keeping recent ones intact.
   */
  private async summarizeOldMessages(messages: ChatMessage[]): Promise<ChatMessage[]> {
    if (messages.length <= chatConfig.MESSAGE_SUMMARY_THRESHOLD) {
      return messages;
    }

    const messagesToSummarize = messages.slice(0, -chatConfig.MESSAGE_SUMMARY_KEEP_COUNT);
    const recentMessages = messages.slice(-chatConfig.MESSAGE_SUMMARY_KEEP_COUNT);

    // Construct a prompt for summarization
    const summaryPrompt = `Summarize the key points of the following conversation concisely:
${messagesToSummarize.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`;

    try {
      let summary = '';
      const summaryStream = bedrockService.chat(
          [{ role: 'user', content: summaryPrompt }], 
          bedrockService.chatModel
      );
      
      for await (const chunk of summaryStream) {
          try {
            const parsed = JSON.parse(chunk);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                summary += parsed.delta.text;
            } else if (parsed.type === 'message_delta' && parsed.usage) {
                // Ignore usage-only chunks for content
            } else {
                // Fallback for unknown JSON structure, stringify?
                // Or assume chunk *is* the text if not known structure?
                // Let's assume raw text if parsing fails or structure unknown
            }
          } catch (e) {
             // If JSON parsing fails, assume chunk is raw text
             summary += chunk;
          }
      }

      if (!summary) {
          console.warn('Summarization resulted in empty content.');
          // Decide fallback: return all messages? Or just recent?
          return messages; // Return original if summary fails
      }

      const summaryMessage: ChatMessage = {
        role: 'system', 
        content: `[Summary of earlier conversation]: ${summary.trim()}`
      };

      return [summaryMessage, ...recentMessages];
    } catch (error) {
      console.error('Failed to summarize messages:', error);
      return recentMessages; // Fallback on error
    }
  }

  /**
   * Generates an AI response stream using Bedrock.
   */
  async * generateAiStream(
    messages: ChatMessage[],
    systemPrompt: string,
    context?: string, 
    ragSources?: Source[] 
  ): AsyncGenerator<string, void, unknown> {
    
    const summarizedMessages = await this.summarizeOldMessages(messages);
    
    // Ensure history does not start with an assistant message (bedrockService.chat might handle this)
    // Add checks if needed based on bedrockService.chat implementation
    if (summarizedMessages.length > 0 && summarizedMessages[0].role === 'assistant') {
        console.warn("Conversation history starts with an assistant message. This might affect model performance.");
    }
    // Ensure history ends with a user message (bedrockService.chat might handle this)
    if (summarizedMessages.length === 0 || summarizedMessages[summarizedMessages.length - 1].role !== 'user') {
        console.error("Messages must end with a user message.");
        throw new Error("Cannot generate AI response without a final user message.");
    }

    try {
      const stream = bedrockService.chat(summarizedMessages, bedrockService.chatModel);
      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error) {
      console.error('Error generating AI stream:', error);
      yield JSON.stringify({ type: 'error', error: 'Failed to get response from AI model.' }); 
    }
  }

  /**
   * Generates a single text completion (e.g., for summarization or title generation).
   */
  async generateSingleText(prompt: string, options?: { temperature?: number, maxTokens?: number }): Promise<string> {
    try {
      let fullText = '';
      const stream = bedrockService.chat([{ role: 'user', content: prompt }], bedrockService.chatModel);
      for await (const chunk of stream) {
           try {
             const parsed = JSON.parse(chunk);
             if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                 fullText += parsed.delta.text;
             } else if (parsed.type === 'message_delta' && parsed.usage) {
                 // Ignore
             } else {
                 // Fallback?
             }
           } catch (e) {
              fullText += chunk;
           }
      }
      return fullText.trim();
    } catch (error) {
      console.error('Error generating single text completion:', error);
      throw new Error('Failed to generate text completion from AI model.');
    }
  }

   /**
   * Generates image embedding using Bedrock.
   */
  async generateImageEmbedding(imageBase64: string, textContext?: string): Promise<number[]> {
    const operation = () => bedrockService.embedImage(imageBase64, textContext);
    try {
        return await this.retryOperation(operation);
    } catch (error) {
        console.error('Error generating image embedding:', error);
        throw new Error('Failed to generate image embedding from AI model.');
    }
  }

}

export const bedrockInteractionService = new BedrockInteractionService();
