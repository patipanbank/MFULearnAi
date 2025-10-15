import { AIMessage } from "@langchain/core/messages";
import { ChatState } from "../state/chatState";
import { createAgentExecutor } from "../../langchain/agents/agentFactory";
import logger from "../../utils/logger";

/**
 * Agent Node
 * Executes the LangChain agent to process user messages
 * Decides whether to call tools or generate final response
 */
export async function agentNode(state: ChatState): Promise<Partial<ChatState>> {
  logger.info('🤖 Agent Node: Starting agent execution', {
    chatId: state.chatId,
    iteration: state.currentIteration,
    maxIterations: state.maxIterations,
  });

  try {
    // Check if we've exceeded max iterations
    if (state.currentIteration >= state.maxIterations) {
      logger.warn('⚠️ Agent Node: Max iterations reached', {
        chatId: state.chatId,
        iterations: state.currentIteration,
      });

      return {
        messages: [
          new AIMessage({
            content: "I apologize, but I've reached the maximum number of steps. Please try rephrasing your question or breaking it into smaller parts.",
          }),
        ],
        shouldContinue: false,
        metadata: {
          ...state.metadata,
          maxIterationsReached: true,
        },
      };
    }

    // Create agent executor with current state
    const agentExecutor = await createAgentExecutor({
      chatId: state.chatId,
      userId: state.userId,
      agentId: state.agentId,
      modelId: state.modelId,
      systemPrompt: state.systemPrompt,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      collectionNames: state.collectionNames,
      allowedTools: state.allowedTools,
    });

    // Get the last user message
    const lastMessage = state.messages[state.messages.length - 1];
    const chatHistory = state.messages.slice(0, -1);

    logger.info('🤖 Agent Node: Invoking agent', {
      chatId: state.chatId,
      userMessage: lastMessage.content.toString().substring(0, 100),
      historyLength: chatHistory.length,
    });

    // Execute agent
    const result = await agentExecutor.invoke({
      input: lastMessage.content,
      chat_history: chatHistory,
    });

    logger.info('✅ Agent Node: Agent execution completed', {
      chatId: state.chatId,
      hasOutput: !!result.output,
      intermediateSteps: result.intermediateSteps?.length || 0,
    });

    // Check if agent wants to call tools
    const hasToolCalls = result.intermediateSteps && result.intermediateSteps.length > 0;

    if (hasToolCalls) {
      // Agent decided to use tools
      logger.info('🔧 Agent Node: Agent wants to call tools', {
        chatId: state.chatId,
        toolCount: result.intermediateSteps.length,
        tools: result.intermediateSteps.map((step: any) => step.action?.tool).filter(Boolean),
      });

      return {
        currentIteration: state.currentIteration + 1,
        shouldContinue: true,
        metadata: {
          ...state.metadata,
          lastAgentDecision: 'call_tools',
          intermediateSteps: result.intermediateSteps,
        },
      };
    } else {
      // Agent generated final response
      logger.info('💬 Agent Node: Agent generated final response', {
        chatId: state.chatId,
        responseLength: result.output?.length || 0,
      });

      return {
        messages: [
          new AIMessage({
            content: result.output || 'I apologize, but I could not generate a response.',
          }),
        ],
        shouldContinue: false,
        metadata: {
          ...state.metadata,
          lastAgentDecision: 'final_response',
          totalIterations: state.currentIteration + 1,
        },
      };
    }

  } catch (error: any) {
    logger.error('❌ Agent Node: Error during execution', {
      chatId: state.chatId,
      error: error.message,
      stack: error.stack,
    });

    return {
      messages: [
        new AIMessage({
          content: 'I apologize, but I encountered an error while processing your request. Please try again.',
        }),
      ],
      error: error.message,
      errorDetails: error,
      shouldContinue: false,
    };
  }
}
