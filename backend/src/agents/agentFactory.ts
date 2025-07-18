import { createToolCallingAgent, AgentExecutor } from 'langchain/agents';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Tool } from '@langchain/core/tools';

/**
 * Construct and return a *bare* LangChain AgentExecutor.
 * 
 * This creates an agent that can use tools but does not include memory.
 * Memory is added separately via RunnableWithMessageHistory.
 */
export function createAgent(
  llm: BaseChatModel,
  tools: Tool[],
  prompt: ChatPromptTemplate
): AgentExecutor {
  const agent = createToolCallingAgent({
    llm,
    tools,
    prompt,
  });

  return new AgentExecutor({
    agent,
    tools,
    verbose: true,
  });
} 