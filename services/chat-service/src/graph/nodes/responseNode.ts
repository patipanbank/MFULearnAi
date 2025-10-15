import { ChatState } from "../state/chatState";
import logger from "../../utils/logger";

/**
 * Response Node
 * Final node that processes and validates the assistant's response
 * Handles cleanup and metadata updates
 */
export async function responseNode(state: ChatState): Promise<Partial<ChatState>> {
  logger.info('💬 Response Node: Processing final response', {
    chatId: state.chatId,
    messageCount: state.messages.length,
    iterations: state.currentIteration,
  });

  try {
    // Get the last assistant message
    const lastMessage = state.messages[state.messages.length - 1];

    if (!lastMessage || lastMessage._getType() !== 'ai') {
      logger.warn('⚠️ Response Node: No AI message found', {
        chatId: state.chatId,
      });

      return {
        shouldContinue: false,
      };
    }

    // Validate response
    const content = lastMessage.content.toString();

    if (!content || content.trim().length === 0) {
      logger.warn('⚠️ Response Node: Empty response content', {
        chatId: state.chatId,
      });
    }

    // Update metadata with final statistics
    const finalMetadata = {
      ...state.metadata,
      completedAt: new Date().toISOString(),
      totalIterations: state.currentIteration,
      totalMessages: state.messages.length,
      responseLength: content.length,
      toolsUsed: state.toolResults?.map(t => t.toolName) || [],
      toolExecutionCount: state.toolResults?.length || 0,
    };

    logger.info('✅ Response Node: Response processed successfully', {
      chatId: state.chatId,
      responseLength: content.length,
      totalIterations: state.currentIteration,
      toolsUsed: finalMetadata.toolsUsed,
    });

    return {
      shouldContinue: false,
      metadata: finalMetadata,
    };

  } catch (error: any) {
    logger.error('❌ Response Node: Error processing response', {
      chatId: state.chatId,
      error: error.message,
    });

    return {
      error: error.message,
      errorDetails: error,
      shouldContinue: false,
    };
  }
}
