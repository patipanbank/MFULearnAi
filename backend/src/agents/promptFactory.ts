import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';

/**
 * Build a LangChain prompt template with system prompt and chat history.
 */
export function buildPrompt(systemPrompt: string) {
  return ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
    ['assistant', '{agent_scratchpad}'],
  ]);
} 