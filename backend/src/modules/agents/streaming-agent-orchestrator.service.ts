import { Injectable, Logger } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentExecutionService } from './agent-execution.service';
import { ToolService } from './tool.service';
import { BedrockService } from '../../infrastructure/bedrock/bedrock.service';
import { MemoryService } from '../../services/memory.service';
import { StreamingService } from '../../services/streaming.service';
import { AgentExecutionStatus } from './agent-execution.schema';
import { StreamingAgentExecutionRequest } from '../../common/schemas';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

interface StreamingExecutionResult {
  executionId: string;
  sessionId: string;
  status: 'streaming' | 'completed' | 'error';
}

@Injectable()
export class StreamingAgentOrchestratorService {
  private readonly logger = new Logger(StreamingAgentOrchestratorService.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly agentExecutionService: AgentExecutionService,
    private readonly toolService: ToolService,
    private readonly bedrockService: BedrockService,
    private readonly memoryService: MemoryService,
    private readonly streamingService: StreamingService,
  ) {}

  async executeAgentStreaming(request: StreamingAgentExecutionRequest): Promise<StreamingExecutionResult> {
    const { agentId, sessionId, userId, message, context = [], streamingOptions = {} } = request;
    
    this.logger.log(`🚀 Starting streaming agent execution for agent: ${agentId}, session: ${sessionId}`);

    // Create execution tracking record
    const execution = await this.agentExecutionService.createExecution(agentId, sessionId);
    
    try {
      // Start streaming session
      this.streamingService.startStream(sessionId, execution.id, agentId, userId, message);

      // Get agent configuration
      const agent = await this.agentService.findOne(agentId);
      if (!agent) {
        throw new Error(`Agent with ID ${agentId} not found`);
      }

      // Update status to thinking
      await this.agentExecutionService.updateStatus(execution.id, AgentExecutionStatus.THINKING);

      // Execute in background to allow immediate response
      this.executeStreamingLoop(execution.id, sessionId, agent, message, context, streamingOptions)
        .catch(error => {
          this.logger.error(`❌ Streaming execution failed:`, error.message);
          this.streamingService.emitError(sessionId, error.message, 'EXECUTION_ERROR');
        });

      return {
        executionId: execution.id,
        sessionId,
        status: 'streaming',
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to start streaming execution:`, errorMessage);
      
      // Update execution status to error
      await this.agentExecutionService.updateStatus(execution.id, AgentExecutionStatus.ERROR);
      this.streamingService.emitError(sessionId, errorMessage, 'STARTUP_ERROR');
      
      return {
        executionId: execution.id,
        sessionId,
        status: 'error',
      };
    }
  }

  private async executeStreamingLoop(
    executionId: string,
    sessionId: string,
    agent: any,
    message: string,
    context: Message[],
    streamingOptions: any
  ): Promise<void> {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const toolsUsed: string[] = [];

    try {
      // Get available tools for this agent
      const availableTools = this.getAvailableToolsForAgent(agent);
      
      // Build conversation context
      const conversationHistory = await this.buildConversationContext(sessionId, context, message);
      
      // Get memory context if available
      const memoryContext = await this.getMemoryContext(sessionId, message);
      
      // Build system prompt with tools and context
      const systemPrompt = this.buildSystemPrompt(agent, availableTools, memoryContext);
      
      // Start agent reasoning loop with streaming
      let reasoning = true;
      let iterationCount = 0;
      const maxIterations = 10;
      
      while (reasoning && iterationCount < maxIterations) {
        iterationCount++;
        this.logger.debug(`🔄 Streaming agent reasoning iteration ${iterationCount}`);
        
        // Update progress
        await this.agentExecutionService.updateStatus(
          executionId, 
          AgentExecutionStatus.THINKING, 
          { progress: (iterationCount / maxIterations) * 50 }
        );

        // Call LLM with streaming
        const streamResult = await this.callLLMWithStreaming(
          systemPrompt,
          conversationHistory,
          availableTools,
          sessionId,
          streamingOptions
        );

        totalInputTokens += streamResult.inputTokens || 0;
        totalOutputTokens += streamResult.outputTokens || 0;

        // Check if LLM wants to use a tool
        if (streamResult.toolCall) {
          const { toolName, toolParams, reasoning: toolReasoning } = streamResult.toolCall;
          
          // Emit tool call event
          this.streamingService.emitToolCall(sessionId, toolName, toolParams, toolReasoning);
          
          // Update status to using tool
          await this.agentExecutionService.updateStatus(
            executionId, 
            AgentExecutionStatus.USING_TOOL, 
            { currentTool: toolName, progress: 60 }
          );

          this.logger.debug(`🔧 Agent using tool: ${toolName}`);
          
          try {
            // Execute the tool
            const toolResult = await this.toolService.executeTool(toolName, toolParams);
            toolsUsed.push(toolName);
            
            // Emit tool result
            this.streamingService.emitToolResult(sessionId, toolName, toolResult, true);
            
            // Add tool result to conversation history
            conversationHistory.push({
              role: 'assistant',
              content: `Using tool ${toolName} with params: ${JSON.stringify(toolParams)}`
            });
            
            conversationHistory.push({
              role: 'system',
              content: `Tool result: ${JSON.stringify(toolResult)}`
            });
            
          } catch (toolError) {
            const errorMsg = toolError instanceof Error ? toolError.message : 'Tool execution failed';
            this.streamingService.emitToolResult(sessionId, toolName, null, false, errorMsg);
            
            // Add error to conversation history
            conversationHistory.push({
              role: 'system',
              content: `Tool execution failed: ${errorMsg}`
            });
          }
          
          // Continue reasoning with tool result
          continue;
        }
        
        // If no tool call, we have our final response
        reasoning = false;
      }

      // Update status to responding
      await this.agentExecutionService.updateStatus(
        executionId, 
        AgentExecutionStatus.RESPONDING, 
        { progress: 90 }
      );

      // Complete the stream
      this.streamingService.completeStream(sessionId);

      // Finish execution
      await this.agentExecutionService.finish(executionId, {
        input: totalInputTokens,
        output: totalOutputTokens
      });

      this.logger.log(`✅ Streaming agent execution completed for session: ${sessionId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Streaming execution loop failed:`, errorMessage);
      
      // Update execution status to error
      await this.agentExecutionService.updateStatus(executionId, AgentExecutionStatus.ERROR);
      this.streamingService.emitError(sessionId, errorMessage, 'EXECUTION_ERROR');
    }
  }

  private async callLLMWithStreaming(
    systemPrompt: string,
    messages: Message[],
    availableTools: any[],
    sessionId: string,
    streamingOptions: any
  ): Promise<{
    finalContent: string;
    toolCall?: { toolName: string; toolParams: any; reasoning?: string };
    inputTokens?: number;
    outputTokens?: number;
  }> {
    try {
      // Convert messages to Bedrock format
      const bedrockMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Get the stream from Bedrock
      const stream = await this.bedrockService.converseStream({
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        messages: bedrockMessages,
        systemPrompt,
        toolConfig: availableTools.length > 0 ? { tools: availableTools } : undefined,
        temperature: 0.7,
        maxTokens: 4000,
      });

      let finalContent = '';
      let toolCall: any = undefined;
      let inputTokens = 0;
      let outputTokens = 0;
      
      // Process streaming chunks
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          const textChunk = chunk.delta?.text || '';
          if (textChunk) {
            finalContent += textChunk;
            
            // Emit chunk to streaming service
            this.streamingService.emitChunk(sessionId, textChunk);
            
            // Add artificial delay if requested
            if (streamingOptions.chunkDelay && streamingOptions.chunkDelay > 0) {
              await new Promise(resolve => setTimeout(resolve, streamingOptions.chunkDelay));
            }
          }
        } else if (chunk.type === 'tool_use') {
          // Handle tool use
          toolCall = {
            toolName: chunk.name,
            toolParams: chunk.input,
            reasoning: finalContent.trim(), // The text before tool call is reasoning
          };
        } else if (chunk.type === 'token_usage') {
          inputTokens = chunk.input_tokens || 0;
          outputTokens = chunk.output_tokens || 0;
        }
      }

      return {
        finalContent,
        toolCall,
        inputTokens,
        outputTokens,
      };

    } catch (error) {
      this.logger.error(`Error in streaming LLM call:`, error);
      throw error;
    }
  }

  private getAvailableToolsForAgent(agent: any): any[] {
    const allTools = this.toolService.getAllTools();
    return allTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  private async buildConversationContext(sessionId: string, context: Message[], newMessage: string): Promise<Message[]> {
    const history: Message[] = [...context];
    
    history.push({
      role: 'user',
      content: newMessage,
      timestamp: new Date(),
    });

    return history;
  }

  private async getMemoryContext(sessionId: string, query: string): Promise<string> {
    try {
      const memories = await this.memoryService.searchChatMemory(sessionId, query, 5);
      if (memories && memories.documents && memories.documents[0]) {
        return `Relevant context from previous conversations:\n${memories.documents[0].join('\n')}`;
      }
      return '';
    } catch (error) {
      this.logger.warn(`Failed to retrieve memory context: ${error}`);
      return '';
    }
  }

  private buildSystemPrompt(agent: any, tools: any[], memoryContext: string): string {
    let prompt = agent.systemPrompt || 'You are a helpful AI assistant.';
    
    if (memoryContext) {
      prompt += `\n\nContext:\n${memoryContext}`;
    }
    
    if (tools.length > 0) {
      prompt += `\n\nYou have access to the following tools:\n${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}`;
    }
    
    return prompt;
  }

  // Cancel streaming execution
  async cancelStreamingExecution(sessionId: string): Promise<void> {
    this.streamingService.cancelStream(sessionId);
    this.logger.log(`🛑 Streaming execution cancelled for session: ${sessionId}`);
  }

  // Get streaming status
  async getStreamingStatus(sessionId: string): Promise<any> {
    const session = this.streamingService.getSession(sessionId);
    return {
      isActive: this.streamingService.isSessionActive(sessionId),
      session: session ? {
        executionId: session.executionId,
        agentId: session.agentId,
        userId: session.userId,
        startTime: session.startTime,
        accumulatedResponse: session.accumulatedResponse,
        toolsUsed: session.toolsUsed,
        tokenUsage: session.tokenUsage,
      } : null,
    };
  }
} 