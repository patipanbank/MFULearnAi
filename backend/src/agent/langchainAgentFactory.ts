import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatOpenAI } from '@langchain/openai';
import { ChatBedrockConverse } from '@langchain/aws';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { DynamicTool } from '@langchain/core/tools';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getAllTools, ToolFunction, toolMetadata } from '../services/toolRegistry';
import { redis } from '../lib/redis';
import { memoryService } from '../services/memoryService';

export interface LangChainAgentConfig {
  modelId: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  tools?: { [name: string]: ToolFunction };
  sessionId?: string;
  collections?: string[];
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
 * - เพิ่ม hybrid memory management (Redis + Vectorstore)
 * - รองรับ streaming events แบบ legacy
 * - แก้ไขการเรียกใช้ tool จริงๆ
 */
export async function createLangChainAgent(config: LangChainAgentConfig): Promise<LangChainAgentExecutor> {
  console.log(`🤖 Creating LangChain Agent with model: ${config.modelId}`);
  
  // 1. สร้าง LLM instance
  const llm = createLLM(config.modelId, {
    temperature: config.temperature || 0.7,
    maxTokens: config.maxTokens || 4000
  });
  
  // 2. Get unified tools for this agent
  const allTools = config.tools || getAllTools(config.sessionId || 'default', config.collections || []);
  const langchainTools = convertToolsToLangChain(allTools, config.sessionId);
  
  console.log(`🔧 Available tools for agent: ${langchainTools.map(t => t.name).join(', ')}`);
  
  // 3. สร้าง prompt template
  const prompt = createAgentPrompt(config.systemPrompt);
  
  // 4. สร้าง LangChain Agent
  const agent = await createToolCallingAgent({
    llm,
    tools: langchainTools,
    prompt
  });
  
  // 5. สร้าง AgentExecutor
  const agentExecutor = AgentExecutor.fromAgentAndTools({
    agent,
    tools: langchainTools,
    verbose: true,
    maxIterations: 5
  });
  
  return {
    async run(messages: { role: string; content: string }[], options?: { onEvent?: (event: { type: string; data?: any }) => void; maxSteps?: number }): Promise<string> {
      console.log(`🤖 LangChain Agent.run called with ${messages.length} messages`);
      
      const onEvent = options?.onEvent;
      const maxSteps = options?.maxSteps ?? 5;
      
      try {
        // Memory setup ถูกจัดการที่ ChatService แล้ว (incremental)
        
        // แปลง messages เป็น LangChain format
        const langchainMessages = convertMessagesToLangChain(messages, config.systemPrompt);
        
        // เรียก agent executor พร้อม streaming แบบต่อเนื่อง
        let contentReceived = false;
        let finalAnswer = '';
        
        // สร้าง input พร้อม chat history (เหมือน Legacy)
        const chatHistory = messages.slice(0, -1).map(msg => 
          `${msg.role}: ${msg.content}`
        ).join('\n');
        
        const agentInput = {
          input: messages[messages.length - 1].content,
          chat_history: chatHistory
        };
        
        const stream = await agentExecutor.stream(agentInput, {
          callbacks: [
            {
              handleLLMStart: async (llm, prompts) => {
                console.log(`🤖 LangChain LLM started`);
              },
              handleLLMNewToken: async (token) => {
                console.log(`🤖 LangChain new token: ${token}`);
                contentReceived = true;
                if (onEvent) onEvent({ type: 'chunk', data: token });
              },
              handleLLMError: async (error) => {
                console.error(`❌ LangChain LLM error: ${error}`);
                if (onEvent) onEvent({ type: 'error', data: { error: error.message } });
              },
              handleChainStart: async (chain) => {
                console.log(`🔗 LangChain chain started: ${chain.name}`);
              },
              handleChainEnd: async (output) => {
                console.log(`🔗 LangChain chain ended`);
              },
              handleLLMEnd: async (output) => {
                console.log(`🤖 LangChain LLM ended`);
                finalAnswer = output.generations[0][0].text;
                
                // Check if there are tool calls
                const generation = output.generations[0][0] as any;
                if (generation.tool_calls && generation.tool_calls.length > 0) {
                  console.log(`🔧 Found ${generation.tool_calls.length} tool calls`);
                  for (const toolCall of generation.tool_calls) {
                    console.log(`🔧 Tool call: ${toolCall.name} with args: ${JSON.stringify(toolCall.args)}`);
                  }
                }
              },
              handleToolStart: async (tool) => {
                console.log(`🔧 LangChain tool started: ${tool.name}`);
                console.log(`🔧 Tool data: ${JSON.stringify(tool)}`);
                if (onEvent) onEvent({ 
                  type: 'tool_start', 
                  data: { 
                    tool_name: tool.name,
                    tool_input: (tool as any).input || ''
                  } 
                });
              },
              handleToolEnd: async (output) => {
                const toolOutput = output.output || 'Tool completed successfully';
                console.log(`🔧 LangChain tool ended: ${output.name} with result: ${toolOutput}`);
                if (onEvent) onEvent({ 
                  type: 'tool_result', 
                  data: { 
                    tool_name: output.name, 
                    output: toolOutput 
                  } 
                });
              },
              handleToolError: async (error) => {
                console.error(`❌ LangChain tool error: ${error}`);
                if (onEvent) onEvent({ type: 'tool_error', data: { error: error.message } });
              }
            }
          ]
        });
        
        // Collect the final result
        for await (const chunk of stream) {
          if (chunk.output) {
            finalAnswer = chunk.output;
          }
        }
        
        // Send end event with final answer
        if (onEvent) onEvent({ type: 'end', data: { answer: finalAnswer } });
        
        console.log(`🤖 LangChain Agent result: ${finalAnswer.substring(0, 100)}...`);
        
        return finalAnswer;
      } catch (error) {
        console.error('❌ Error in LangChain Agent:', error);
        throw error;
      }
    }
  };
}

/**
 * Setup hybrid memory management (Redis + Vectorstore) - เหมือน Legacy
 */
async function setupHybridMemory(sessionId: string, messages: { role: string; content: string }[]) {
  try {
    console.log(`🧠 Setting up hybrid memory for session ${sessionId}`);
    
    // 1. Redis memory for recent messages (last 10)
    const recentMessages = messages.slice(-10);
    if (recentMessages.length > 0) {
      await redis.set(`chat:recent:${sessionId}`, JSON.stringify(recentMessages), 'EX', 86400);
      console.log(`💾 Stored ${recentMessages.length} recent messages in Redis`);
    }
    
    // 2. Vectorstore memory for long-term storage (every 10 messages)
    if (messages.length % 10 === 0 && messages.length > 0) {
      const messagesForEmbedding = messages.map(msg => ({
        content: msg.content,
        role: msg.role,
        timestamp: new Date().toISOString()
      }));
      
      // Embed messages into vectorstore
      for (const msg of messagesForEmbedding) {
        await memoryService.embedMessage(sessionId, msg.content);
      }
      
      console.log(`📚 Embedded ${messagesForEmbedding.length} messages to vectorstore`);
    }
    
  } catch (error) {
    console.error(`❌ Error setting up hybrid memory: ${error}`);
  }
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
  
  console.log(`🔧 Converting ${Object.keys(tools).length} tools to LangChain format`);
  console.log(`🔧 Session ID: ${sessionId}`);
  
  for (const [name, toolFn] of Object.entries(tools)) {
    // Use metadata from unified registry, fall back to dynamic descriptions
    let description = toolMetadata[name]?.description || `Tool: ${name}`;
    
    // Handle dynamic tool names
    if (name.startsWith('search_chat_memory_')) {
      description = 'Search this chat session memory. Input: search terms';
    } else if (name.startsWith('search_')) {
      description = 'Search knowledge base. Input: search query';
    }
    
    console.log(`🔧 Creating LangChain tool: ${name} - ${description.substring(0, 50)}...`);
    
    const langchainTool = new DynamicTool({
      name,
      description,
      func: async (input: string) => {
        try {
          console.log(`🔧 LangChain Tool called: ${name} with input: ${input}`);
          const result = await toolFn(input, sessionId || '');
          console.log(`🔧 LangChain Tool result: ${result.substring(0, 100)}...`);
          return result;
        } catch (error) {
          console.error(`❌ LangChain Tool error: ${name}`, error);
          // ส่งกลับข้อความ error ที่ชัดเจน
          if (name === 'web_search') {
            return 'Web search is currently unavailable. Please try again later.';
          } else if (name === 'calculator') {
            return 'Calculator error. Please check your mathematical expression.';
          } else if (name.startsWith('memory_')) {
            return 'Memory service is currently unavailable.';
          } else {
            return `Error executing tool ${name}: ${error}`;
          }
        }
      }
    });
    
    langchainTools.push(langchainTool);
  }
  
  return langchainTools;
}

/**
 * สร้าง prompt template สำหรับ agent (เหมือน Legacy) - แก้ไขให้เรียกใช้ tool จริงๆ
 */
function createAgentPrompt(systemPrompt: string): ChatPromptTemplate {
  const defaultPrompt = "You are a helpful AI assistant with access to tools.";
  const finalSystemPrompt = systemPrompt || defaultPrompt;
  
  const improvedPrompt = `${finalSystemPrompt}

EXECUTION PROCESS:
1. Understand the user's request clearly
2. Determine what information or tools are needed
3. Use appropriate tools with correct inputs
4. Provide clear, helpful responses

TOOL USAGE:
- web_search: For current information, news, facts (input: search query)
- calculator: For math calculations (input: mathematical expression)
- knowledge_search: For specific domain knowledge (input: query)
- memory tools: For conversation context

RULES:
- Actually use tools when needed, don't just mention them
- Show your reasoning process
- Provide accurate, complete answers
- If tools fail, try alternatives`;

  return ChatPromptTemplate.fromMessages([
    ["system", improvedPrompt],
    ["human", "Previous: {chat_history}\nCurrent: {input}\nThinking: {agent_scratchpad}"]
  ]);
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