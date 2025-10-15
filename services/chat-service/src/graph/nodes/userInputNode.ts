import { HumanMessage } from "@langchain/core/messages";
import { ChatState } from "../state/chatState";
import logger from "../../utils/logger";

/**
 * User Input Node
 * Processes and validates user input messages
 * First node in the graph execution flow
 */
export async function userInputNode(state: ChatState): Promise<Partial<ChatState>> {
  logger.info('📥 User Input Node: Processing user message', {
    chatId: state.chatId,
    userId: state.userId,
    messageCount: state.messages.length,
  });

  try {
    // Get the latest user message
    const lastMessage = state.messages[state.messages.length - 1];

    if (!lastMessage) {
      throw new Error('No user message found');
    }

    // Validate message
    if (typeof lastMessage.content !== 'string' || lastMessage.content.trim().length === 0) {
      throw new Error('Invalid message content');
    }

    // Check message length
    const maxLength = 10000; // From config
    if (lastMessage.content.length > maxLength) {
      throw new Error(`Message too long. Maximum length is ${maxLength} characters`);
    }

    logger.info('✅ User Input Node: Message validated successfully', {
      chatId: state.chatId,
      contentLength: lastMessage.content.length,
    });

    // Update metadata
    return {
      metadata: {
        ...state.metadata,
        lastUserMessageTime: new Date().toISOString(),
        userMessageProcessed: true,
      },
    };

  } catch (error: any) {
    logger.error('❌ User Input Node: Error processing message', {
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
