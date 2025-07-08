import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BedrockService } from '../bedrock/bedrock.service';
import { ChatService } from '../../modules/chat/chat.service';
import { Redis } from 'ioredis';
import { MemoryService } from '../../services/memory.service';
import { AgentExecutionService } from '../../modules/agents/agent-execution.service';
import { AgentOrchestratorService } from '../../modules/agents/agent-orchestrator.service';
import { AgentService } from '../../modules/agents/agent.service';
import { AgentExecutionStatus } from '../../modules/agents/agent-execution.schema';

interface ChatJobPayload {
  sessionId: string;
  userId: string;
  message: string;
  modelId?: string;
  systemPrompt?: string;
  agentId?: string;
  temperature?: number;
  maxTokens?: number;
}

@Processor('default')
export class ChatWorker extends WorkerHost {
  private readonly logger = new Logger(ChatWorker.name);

  constructor(
    private readonly bedrockService: BedrockService,
    private readonly chatService: ChatService,
    private readonly execService: AgentExecutionService,
    private readonly agentOrchestratorService: AgentOrchestratorService,
    private readonly agentService: AgentService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly memoryService: MemoryService,
  ) {
    super();
  }

  async process(job: Job<ChatJobPayload>): Promise<void> {
    const payload = job.data;
    const channel = `chat:${payload.sessionId}`;

    this.logger.log(`🔄 Processing chat job for session: ${payload.sessionId}`);

    try {
      // Determine if we should use agent execution or simple LLM
      if (payload.agentId) {
        await this.processWithAgent(payload, channel);
      } else {
        await this.processWithSimpleLLM(payload, channel);
      }

      // Send completion signal
      await this.redis.publish(channel, JSON.stringify({ type: 'end' }));
      
      this.logger.log(`✅ Chat job completed for session: ${payload.sessionId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Chat job failed for session ${payload.sessionId}:`, errorMessage);
      
      // Send error to client
      await this.redis.publish(channel, JSON.stringify({ 
        type: 'error', 
        data: { message: 'An error occurred while processing your message' }
      }));
      
      throw error;
    }
  }

  private async processWithAgent(payload: ChatJobPayload, channel: string): Promise<void> {
    const { agentId, sessionId, userId, message } = payload;
    
    this.logger.log(`🤖 Processing with agent: ${agentId}`);

    // Verify agent exists
    const agent = await this.agentService.findOne(agentId!);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }

    // Get chat history for context
    const chat = await this.chatService.getChatById(sessionId);
    const context = (chat?.messages || []).slice(-10).map((m: any) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp
    }));

    // Send status update
    await this.redis.publish(channel, JSON.stringify({ 
      type: 'status', 
      data: { status: 'thinking', message: 'Agent is processing your request...' }
    }));

    try {
      // Execute agent
      const agentResult = await this.agentOrchestratorService.executeAgent({
        agentId: agentId!,
        sessionId,
        userId,
        message,
        context
      });

      // Send tool usage information if any tools were used
      if (agentResult.toolsUsed.length > 0) {
        await this.redis.publish(channel, JSON.stringify({ 
          type: 'tools_used', 
          data: { 
            tools: agentResult.toolsUsed,
            message: `Used tools: ${agentResult.toolsUsed.join(', ')}`
          }
        }));
      }

      // Stream the response
      await this.streamResponse(agentResult.response, channel);

      // Save assistant message to chat
      await this.chatService.addMessage(sessionId, {
        role: 'assistant',
        content: agentResult.response,
        timestamp: new Date(),
      } as any);

      // Send token usage info
      await this.redis.publish(channel, JSON.stringify({ 
        type: 'token_usage', 
        data: agentResult.tokenUsage
      }));

    } catch (error) {
      this.logger.error(`Agent execution failed: ${error}`);
      throw error;
    }
  }

  private async processWithSimpleLLM(payload: ChatJobPayload, channel: string): Promise<void> {
    this.logger.log(`🧠 Processing with simple LLM`);

    // Build chat history for context (last 10 messages)
    const chat = await this.chatService.getChatById(payload.sessionId);
    const history = (chat?.messages || []).slice(-10).map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    // Add current user message
    history.push({ role: 'user', content: payload.message });

    // Memory retrieval for context
    let finalSystemPrompt = payload.systemPrompt || 'You are a helpful AI assistant.';
    try {
      const memRes: any = await this.memoryService.searchChatMemory(payload.sessionId, payload.message, 5);
      const docs: string[] = memRes?.documents?.[0] ?? [];
      if (docs.length > 0) {
        const context = docs.map((d: string) => `- ${d}`).join('\n');
        const ctxBlock = `\n\nRelevant past context:\n${context}`;
        finalSystemPrompt = finalSystemPrompt + ctxBlock;
      }
    } catch (err) {
      this.logger.warn('Memory search error:', err);
    }

    // Send status update
    await this.redis.publish(channel, JSON.stringify({ 
      type: 'status', 
      data: { status: 'generating', message: 'Generating response...' }
    }));

    // Stream answer from Bedrock
    const stream = await this.bedrockService.converseStream({
      modelId: payload.modelId,
      messages: history,
      systemPrompt: finalSystemPrompt,
      temperature: payload.temperature,
      maxTokens: payload.maxTokens,
    });

    const buffer: string[] = [];

    for await (const chunk of stream) {
      let content: string | undefined;
      if (typeof chunk === 'string') {
        content = chunk;
      } else if (chunk?.data) {
        content = chunk.data;
      } else if (chunk?.delta?.text) {
        content = chunk.delta.text;
      }

      if (!content) continue;

      buffer.push(content);
      await this.redis.publish(channel, JSON.stringify({ type: 'chunk', data: content }));
    }

    const finalText = buffer.join('');

    // Save assistant message
    await this.chatService.addMessage(payload.sessionId, {
      role: 'assistant',
      content: finalText,
      timestamp: new Date(),
    } as any);

    // Periodic embedding (every 10 messages)
    const updatedChat = await this.chatService.getChatById(payload.sessionId);
    const messageCount = updatedChat?.messages.length ?? 0;
    
    if (messageCount > 0 && messageCount % 10 === 0) {
      await this.embedChatHistory(payload.sessionId, updatedChat);
    }
  }

  private async streamResponse(response: string, channel: string): Promise<void> {
    // Simulate streaming by splitting response into chunks
    const words = response.split(' ');
    const chunkSize = 5; // 5 words per chunk
    
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      await this.redis.publish(channel, JSON.stringify({ type: 'chunk', data: chunk + ' ' }));
      
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  private async embedChatHistory(sessionId: string, chat: any): Promise<void> {
    try {
      if (!chat?.messages) return;

      const memMsgs = chat.messages.map((m: any) => ({
        id: m._id?.toString() ?? '',
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }));
      
      await this.memoryService.addChatMemory(sessionId, memMsgs);
      this.logger.debug(`📚 Embedded ${memMsgs.length} messages for session: ${sessionId}`);
      
    } catch (error) {
      this.logger.warn(`Failed to embed chat history: ${error}`);
    }
  }
}