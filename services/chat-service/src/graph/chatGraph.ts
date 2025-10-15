import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatState, chatStateChannels } from "./state/chatState";
import { userInputNode } from "./nodes/userInputNode";
import { agentNode } from "./nodes/agentNode";
import { toolNode } from "./nodes/toolNode";
import { responseNode } from "./nodes/responseNode";
import {
  shouldCallTools,
  shouldContinueIteration,
  validateInput
} from "./edges/conditionalEdges";
import { getCheckpointer } from "../checkpoints/checkpointerFactory";
import logger from "../utils/logger";

/**
 * Create LangGraph StateGraph for Chat Service
 *
 * Graph Flow:
 * START → userInput → agent → [tools → agent]* → response → END
 *
 * The agent can loop back to tools multiple times until:
 * - Final response is generated
 * - Max iterations reached
 * - Error occurs
 */
export async function createChatGraph() {
  logger.info('🏗️ Creating LangGraph StateGraph for chat service');

  // Create StateGraph with channels
  const workflow = new StateGraph<ChatState>({
    channels: chatStateChannels as any,
  });

  // Add nodes to the graph
  logger.info('📍 Adding nodes to graph');

  workflow.addNode("userInput", userInputNode);
  workflow.addNode("agent", agentNode);
  workflow.addNode("tools", toolNode);
  workflow.addNode("response", responseNode);

  // Add edges
  logger.info('🔗 Adding edges to graph');

  // START → userInput
  workflow.addEdge(START, "userInput");

  // userInput → agent (with validation)
  workflow.addConditionalEdges(
    "userInput",
    validateInput,
    {
      agent: "agent",
      end: END,
    }
  );

  // agent → tools OR response (based on agent decision)
  workflow.addConditionalEdges(
    "agent",
    shouldCallTools,
    {
      tools: "tools",
      response: "response",
      end: END,
    }
  );

  // tools → agent (loop back for next iteration)
  workflow.addConditionalEdges(
    "tools",
    shouldContinueIteration,
    {
      agent: "agent",
      response: "response",
      end: END,
    }
  );

  // response → END
  workflow.addEdge("response", END);

  // Get checkpointer (Redis or Postgres based on config)
  const checkpointer = await getCheckpointer();

  // Compile graph with checkpointer
  logger.info('⚙️ Compiling graph with checkpointer');

  const graph = workflow.compile({
    checkpointer,
    // Interrupt points for human-in-the-loop (future enhancement)
    interruptBefore: [],
    interruptAfter: [],
  });

  logger.info('✅ LangGraph StateGraph created successfully');

  return graph;
}

/**
 * Singleton instance of the chat graph
 */
let chatGraphInstance: Awaited<ReturnType<typeof createChatGraph>> | null = null;

/**
 * Get or create chat graph instance
 */
export async function getChatGraph() {
  if (!chatGraphInstance) {
    chatGraphInstance = await createChatGraph();
  }
  return chatGraphInstance;
}
