import { AgentExecutor } from 'langchain/agents';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Tool } from '@langchain/core/tools';
export declare function createAgent(llm: BaseChatModel, tools: Tool[], prompt: ChatPromptTemplate): AgentExecutor;
//# sourceMappingURL=agentFactory.d.ts.map