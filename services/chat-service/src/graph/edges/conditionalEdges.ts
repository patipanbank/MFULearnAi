import { ChatState } from "../state/chatState";
import logger from "../../utils/logger";

/**
 * Conditional Edge Functions
 * Determine routing logic between nodes in the graph
 */

/**
 * Decide whether agent should call tools or generate final response
 * Called after agent node execution
 */
export function shouldCallTools(state: ChatState): "__start__" | "__end__" | "tools" | "response" {
  // Check for errors first
  if (state.error) {
    logger.warn('⚠️ Conditional Edge: Error detected, routing to end', {
      chatId: state.chatId,
      error: state.error,
    });
    return "__end__";
  }

  // Check if should continue
  if (!state.shouldContinue) {
    logger.info('ℹ️ Conditional Edge: Should not continue, routing to response', {
      chatId: state.chatId,
    });
    return "response";
  }

  // Check if max iterations reached
  if (state.currentIteration >= state.maxIterations) {
    logger.warn('⚠️ Conditional Edge: Max iterations reached, routing to response', {
      chatId: state.chatId,
      iterations: state.currentIteration,
    });
    return "response";
  }

  // Check if agent wants to call tools
  const lastDecision = state.metadata?.lastAgentDecision;

  if (lastDecision === 'call_tools') {
    logger.info('🔧 Conditional Edge: Agent wants to call tools', {
      chatId: state.chatId,
      iteration: state.currentIteration,
    });
    return "tools";
  }

  // Default to response
  logger.info('💬 Conditional Edge: Routing to response', {
    chatId: state.chatId,
  });
  return "response";
}

/**
 * Decide whether to continue iteration after tool execution
 * Called after tool node execution
 */
export function shouldContinueIteration(state: ChatState): "__start__" | "__end__" | "agent" | "response" {
  // Check for errors
  if (state.error) {
    logger.warn('⚠️ Conditional Edge: Error after tools, routing to end', {
      chatId: state.chatId,
      error: state.error,
    });
    return "__end__";
  }

  // Check if should continue
  if (!state.shouldContinue) {
    logger.info('ℹ️ Conditional Edge: Should not continue after tools, routing to response', {
      chatId: state.chatId,
    });
    return "response";
  }

  // Check if max iterations reached
  if (state.currentIteration >= state.maxIterations) {
    logger.warn('⚠️ Conditional Edge: Max iterations reached after tools, routing to response', {
      chatId: state.chatId,
      iterations: state.currentIteration,
    });
    return "response";
  }

  // Continue to agent for next iteration
  logger.info('🔄 Conditional Edge: Continuing to agent for next iteration', {
    chatId: state.chatId,
    iteration: state.currentIteration,
  });
  return "agent";
}

/**
 * Validate user input before processing
 * Called after user input node
 */
export function validateInput(state: ChatState): "__start__" | "__end__" | "agent" {
  // Check for errors in input validation
  if (state.error) {
    logger.warn('⚠️ Conditional Edge: Input validation error, routing to end', {
      chatId: state.chatId,
      error: state.error,
    });
    return "__end__";
  }

  // Check if messages exist
  if (!state.messages || state.messages.length === 0) {
    logger.warn('⚠️ Conditional Edge: No messages, routing to end', {
      chatId: state.chatId,
    });
    return "__end__";
  }

  // Proceed to agent
  logger.info('✅ Conditional Edge: Input validated, routing to agent', {
    chatId: state.chatId,
  });
  return "agent";
}
