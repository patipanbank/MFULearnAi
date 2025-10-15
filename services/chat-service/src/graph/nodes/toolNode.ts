import { ChatState } from "../state/chatState";
import logger from "../../utils/logger";

/**
 * Tool Node
 * Executes tools requested by the agent
 * Handles tool execution and error recovery
 */
export async function toolNode(state: ChatState): Promise<Partial<ChatState>> {
  logger.info('🔧 Tool Node: Starting tool execution', {
    chatId: state.chatId,
    iteration: state.currentIteration,
  });

  try {
    // Get intermediate steps from metadata
    const intermediateSteps = state.metadata?.intermediateSteps || [];

    if (intermediateSteps.length === 0) {
      logger.warn('⚠️ Tool Node: No tools to execute', {
        chatId: state.chatId,
      });

      return {
        shouldContinue: false,
      };
    }

    const toolResults: Array<{
      toolName: string;
      input: string;
      output: string;
      timestamp: Date;
    }> = [];

    // Execute each tool
    for (const step of intermediateSteps) {
      const toolName = step.action?.tool;
      const toolInput = step.action?.toolInput;

      if (!toolName || !toolInput) {
        continue;
      }

      logger.info('🔧 Tool Node: Executing tool', {
        chatId: state.chatId,
        toolName,
        inputLength: JSON.stringify(toolInput).length,
      });

      try {
        // Tool execution is handled by AgentExecutor
        // Here we just collect results for tracking
        toolResults.push({
          toolName,
          input: JSON.stringify(toolInput),
          output: step.observation || '',
          timestamp: new Date(),
        });

        logger.info('✅ Tool Node: Tool executed successfully', {
          chatId: state.chatId,
          toolName,
          outputLength: step.observation?.length || 0,
        });

      } catch (toolError: any) {
        logger.error('❌ Tool Node: Tool execution error', {
          chatId: state.chatId,
          toolName,
          error: toolError.message,
        });

        toolResults.push({
          toolName,
          input: JSON.stringify(toolInput),
          output: `Error: ${toolError.message}`,
          timestamp: new Date(),
        });
      }
    }

    logger.info('✅ Tool Node: All tools executed', {
      chatId: state.chatId,
      toolCount: toolResults.length,
    });

    // Return to agent node for next iteration
    return {
      toolResults: [...(state.toolResults || []), ...toolResults],
      shouldContinue: true,
      metadata: {
        ...state.metadata,
        lastToolExecutionTime: new Date().toISOString(),
        toolsExecutedCount: toolResults.length,
      },
    };

  } catch (error: any) {
    logger.error('❌ Tool Node: Error during tool execution', {
      chatId: state.chatId,
      error: error.message,
      stack: error.stack,
    });

    return {
      error: error.message,
      errorDetails: error,
      shouldContinue: false,
    };
  }
}
