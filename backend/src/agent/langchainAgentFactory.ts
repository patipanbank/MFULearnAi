import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatOpenAI } from '@langchain/openai';
import { ChatBedrockConverse } from '@langchain/aws';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { DynamicTool } from '@langchain/core/tools';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ToolFunction } from '../services/toolRegistry';
import { redis } from '../lib/redis';
import { memoryService } from '../services/memoryService';

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
  
  // 2. แปลง tools เป็น LangChain Tools
  const langchainTools = convertToolsToLangChain(config.tools, config.sessionId);
  
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
        // Smart Memory Management (เหมือน Legacy)
        if (config.sessionId) {
          await setupHybridMemory(config.sessionId, messages);
        }
        
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
    let description = `Tool: ${name}`;
    
    // เพิ่ม description ที่ชัดเจนสำหรับแต่ละ tool
    if (name === 'web_search') {
      description = 'Search the web for current information. Use this tool when you need to find recent or up-to-date information about any topic. Input should be a search query.';
    } else if (name === 'calculator') {
      description = 'Perform mathematical calculations. Use this tool when you need to solve math problems or perform calculations. Input should be a mathematical expression.';
    } else if (name === 'current_date') {
      description = 'Get the current date and time. Use this tool when you need to know the current date or time.';
    } else if (name === 'memory_search') {
      description = 'Search through conversation memory to find relevant context from previous messages. Use this tool when you need to recall information from earlier in the conversation.';
    } else if (name === 'memory_embed') {
      description = 'Embed new information into conversation memory for future reference. Use this tool to store important information from the current conversation.';
    } else if (name.startsWith('search_chat_memory_')) {
      description = 'Search through the current chat session history to find relevant context. Use this tool to recall information from this specific conversation.';
    } else if (name.startsWith('embed_chat_memory_')) {
      description = 'Embed new message into chat memory for this session. Use this tool to store important information from the current conversation.';
    } else if (name.startsWith('recent_context_')) {
      description = 'Get recent context from memory (last 10 messages). Use this tool to get a summary of recent conversation history.';
    } else if (name.startsWith('full_context_')) {
      description = 'Get full conversation context from memory. Use this tool to get the complete conversation history.';
    } else if (name.startsWith('clear_memory_')) {
      description = 'Clear all chat memory for this session. Use this tool to reset the conversation memory.';
    } else if (name.startsWith('memory_stats_')) {
      description = 'Get memory usage statistics for this session. Use this tool to check memory usage.';
    } else if (name.startsWith('search_')) {
      description = `Search and retrieve information from the knowledge base. Use this when you need specific information.`;
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
  const defaultPrompt = "You are a helpful assistant. You have access to a number of tools and must use them when appropriate. Always focus on answering the current user's question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.";
  
  const finalSystemPrompt = systemPrompt || defaultPrompt;
  
  const legacyPrompt = `${finalSystemPrompt}

IMPORTANT INSTRUCTIONS:
1. If the user asks you to search for information, you MUST use the web_search tool
2. If the user asks for calculations, use the calculator tool
3. If you need to recall previous conversation context, use memory tools
4. Always use the appropriate tool when needed - do not try to answer without tools
5. When using web_search, provide the search query as input
6. When using calculator, provide the mathematical expression as input
7. When using knowledge base search, provide the search query as input
8. Use memory tools to maintain conversation context across long conversations
9. Hybrid memory management: Redis for recent messages, Vectorstore for long-term storage
10. IMPORTANT: If the user gives you a specific instruction (like "answer only with X"), you MUST follow that instruction exactly

Available tools:
- web_search: Search the web for current information
- calculator: Perform mathematical calculations
- current_date: Get current date and time
- memory_search: Search conversation memory
- memory_embed: Store information in memory
- Various session-specific memory tools
- Knowledge base search tools

CRITICAL: You MUST use tools when appropriate. Do not just say you will use a tool - actually call the tool function. When the user asks for current information, you MUST use web_search to get the latest data.`;

  return ChatPromptTemplate.fromMessages([
    ["system", legacyPrompt],
    ["human", "Chat History: {chat_history}\nQuestion: {input}\nThought: {agent_scratchpad}"]
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