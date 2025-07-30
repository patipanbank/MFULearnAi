import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { ChatOpenAI } from '@langchain/openai';
import { ChatBedrockConverse } from '@langchain/aws';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { DynamicTool } from '@langchain/core/tools';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ToolFunction } from '../services/toolRegistry';

export interface LangChainAgentConfig {
  modelId: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  tools: { [name: string]: ToolFunction };
  sessionId?: string;
}

export interface LangChainAgentExecutor {
  run: (
    messages: { role: string; content: string }[],
    options?: {
      onEvent?: (event: { type: string; data?: any }) => void;
      maxSteps?: number;
    }
  ) => Promise<string>;
}

/**
 * สร้าง LangChain Agent ที่ใช้ LangChain Agent framework เต็มรูปแบบ
 */
export async function createLangChainAgent(config: LangChainAgentConfig): Promise<LangChainAgentExecutor> {
  console.log(`🤖 Creating LangChain Agent with model: ${config.modelId}`);
  
  // 1. สร้าง LLM instance
  const llm = createLLM(config.modelId, {
    temperature: config.temperature || 0.7,
    maxTokens: config.maxTokens || 4000
  });
  
  // 2. แปลง tools เป็น LangChain Tools
  const langchainTools = convertToolsToLangChain(config.tools, config.sessionId);
  
  // 3. สร้าง prompt template
  const prompt = createAgentPrompt(config.systemPrompt);
  
  // 4. สร้าง LangChain Agent
  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools: langchainTools,
    prompt
  });
  
  // 5. สร้าง AgentExecutor
  const agentExecutor = AgentExecutor.fromAgentAndTools({
    agent,
    tools: langchainTools,
    verbose: true
  });
  
  return {
    async run(messages: { role: string; content: string }[], options?: { onEvent?: (event: { type: string; data?: any }) => void; maxSteps?: number }): Promise<string> {
      console.log(`🤖 LangChain Agent.run called with ${messages.length} messages`);
      
      const onEvent = options?.onEvent;
      const maxSteps = options?.maxSteps ?? 5;
      
      try {
        // แปลง messages เป็น LangChain format
        const langchainMessages = convertMessagesToLangChain(messages, config.systemPrompt);
        
        // เรียก agent executor พร้อม streaming
        const result = await agentExecutor.invoke({
          input: langchainMessages,
          maxIterations: maxSteps
        }, {
          callbacks: [
            {
              handleLLMStart: async (llm, prompts) => {
                console.log(`🤖 LangChain LLM started`);
                if (onEvent) onEvent({ type: 'chunk', data: 'กำลังประมวลผล...' });
              },
              handleLLMNewToken: async (token) => {
                console.log(`🤖 LangChain new token: ${token}`);
                if (onEvent) onEvent({ type: 'chunk', data: token });
              },
              handleLLMEnd: async (output) => {
                console.log(`🤖 LangChain LLM ended`);
                if (onEvent) onEvent({ type: 'end', data: { answer: output.generations[0][0].text } });
              },
              handleToolStart: async (tool) => {
                console.log(`🔧 LangChain tool started: ${tool.name}`);
                if (onEvent) onEvent({ type: 'tool_start', data: { tool_name: tool.name } });
              },
              handleToolEnd: async (output) => {
                console.log(`🔧 LangChain tool ended: ${output.name}`);
                if (onEvent) onEvent({ type: 'tool_result', data: { tool_name: output.name, output: output.output } });
              },
              handleToolError: async (error) => {
                console.error(`❌ LangChain tool error: ${error}`);
                if (onEvent) onEvent({ type: 'tool_error', data: { error: error.message } });
              }
            }
          ]
        });
        
        console.log(`🤖 LangChain Agent result: ${result.output.substring(0, 100)}...`);
        
        return result.output;
      } catch (error) {
        console.error('❌ Error in LangChain Agent:', error);
        throw error;
      }
    }
  };
}

/**
 * สร้าง LLM instance ตาม modelId
 */
function createLLM(modelId: string, config: { temperature?: number; maxTokens?: number }) {
  if (modelId.includes('anthropic') || modelId.includes('claude')) {
    return new ChatBedrockConverse({
      model: modelId,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      region: process.env.AWS_REGION || 'us-east-1'
    });
  } else if (modelId.includes('gpt') || modelId.includes('openai')) {
    return new ChatOpenAI({
      modelName: modelId,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      openAIApiKey: process.env.OPENAI_API_KEY
    });
  } else {
    // Fallback to Bedrock
    return new ChatBedrockConverse({
      model: modelId,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }
}

/**
 * แปลง tools เป็น LangChain Tools
 */
function convertToolsToLangChain(tools: { [name: string]: ToolFunction }, sessionId?: string): DynamicTool[] {
  const langchainTools: DynamicTool[] = [];
  
  for (const [name, toolFn] of Object.entries(tools)) {
    const langchainTool = new DynamicTool({
      name,
      description: `Tool: ${name}`,
      func: async (input: string) => {
        try {
          console.log(`🔧 LangChain Tool called: ${name} with input: ${input}`);
          const result = await toolFn(input, sessionId || '');
          console.log(`🔧 LangChain Tool result: ${result.substring(0, 100)}...`);
          return result;
        } catch (error) {
          console.error(`❌ LangChain Tool error: ${name}`, error);
          return `Error executing tool ${name}: ${error}`;
        }
      }
    });
    
    langchainTools.push(langchainTool);
  }
  
  return langchainTools;
}

/**
 * สร้าง prompt template สำหรับ agent
 */
function createAgentPrompt(systemPrompt: string): ChatPromptTemplate {
  const template = ChatPromptTemplate.fromMessages([
    ["system", `You are a helpful AI assistant. Follow these guidelines:

${systemPrompt}

You have access to various tools to help answer questions. When you need to use a tool, the system will automatically provide it for you.

Please provide clear, helpful responses to user questions.`],
    ["human", "Question: {input}\nThought: {agent_scratchpad}"]
  ]);

  return template;
}

/**
 * แปลง messages เป็น LangChain format
 */
function convertMessagesToLangChain(messages: { role: string; content: string }[], systemPrompt: string) {
  const langchainMessages = [];
  
  // เพิ่ม system message
  if (systemPrompt) {
    langchainMessages.push(new SystemMessage(systemPrompt));
  }
  
  // แปลง user/assistant messages
  for (const message of messages) {
    if (message.role === 'user') {
      langchainMessages.push(new HumanMessage(message.content));
    } else if (message.role === 'assistant') {
      langchainMessages.push(new AIMessage(message.content));
    }
  }
  
  return langchainMessages;
} 