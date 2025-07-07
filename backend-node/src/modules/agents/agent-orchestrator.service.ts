import { Injectable, Logger } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentExecutionService } from './agent-execution.service';
import { ToolService, ToolResult } from './tool.service';
import { BedrockService } from '../../infrastructure/bedrock/bedrock.service';
import { MemoryService } from '../../services/memory.service';
import { AgentExecutionStatus } from './agent-execution.schema';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

interface AgentExecutionRequest {
  agentId: string;
  sessionId: string;
  userId: string;
  message: string;
  context?: Message[];
}

interface AgentExecutionResult {
  executionId: string;
  response: string;
  toolsUsed: string[];
  tokenUsage: {
    input: number;
    output: number;
  };
  status: AgentExecutionStatus;
}

@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly agentExecutionService: AgentExecutionService,
    private readonly toolService: ToolService,
    private readonly bedrockService: BedrockService,
    private readonly memoryService: MemoryService,
  ) {}

  async executeAgent(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    const { agentId, sessionId, userId, message, context = [] } = request;
    
    this.logger.log(`🤖 Starting agent execution for agent: ${agentId}, session: ${sessionId}`);

    // Create execution tracking record
    const execution = await this.agentExecutionService.createExecution(agentId, sessionId);
    
    try {
      // Get agent configuration
      const agent = await this.agentService.findOne(agentId);
      if (!agent) {
        throw new Error(`Agent with ID ${agentId} not found`);
      }

      // Update status to thinking
      await this.agentExecutionService.updateStatus(execution.id, AgentExecutionStatus.THINKING);

      // Get available tools for this agent
      const availableTools = this.getAvailableToolsForAgent(agent);
      
      // Build conversation context
      const conversationHistory = await this.buildConversationContext(sessionId, context, message);
      
      // Get memory context if available
      const memoryContext = await this.getMemoryContext(sessionId, message);
      
      // Build system prompt with tools and context
      const systemPrompt = this.buildSystemPrompt(agent, availableTools, memoryContext);
      
      // Initialize tracking variables
      const toolsUsed: string[] = [];
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let finalResponse = '';
      
      // Start agent reasoning loop
      let reasoning = true;
      let iterationCount = 0;
      const maxIterations = 10; // Prevent infinite loops
      
      while (reasoning && iterationCount < maxIterations) {
        iterationCount++;
        this.logger.debug(`🔄 Agent reasoning iteration ${iterationCount}`);
        
        // Update progress
        await this.agentExecutionService.updateStatus(
          execution.id, 
          AgentExecutionStatus.THINKING, 
          { progress: (iterationCount / maxIterations) * 50 }
        );

        // Call LLM with current context
        const llmResponse = await this.callLLMWithToolSupport(
          systemPrompt,
          conversationHistory,
          availableTools
        );

        totalInputTokens += llmResponse.inputTokens || 0;
        totalOutputTokens += llmResponse.outputTokens || 0;

        // Check if LLM wants to use a tool
        if (llmResponse.toolCall) {
          const { toolName, toolParams } = llmResponse.toolCall;
          
          // Update status to using tool
          await this.agentExecutionService.updateStatus(
            execution.id, 
            AgentExecutionStatus.USING_TOOL, 
            { currentTool: toolName, progress: 60 }
          );

          this.logger.debug(`🔧 Agent using tool: ${toolName}`);
          
          // Execute the tool
          const toolResult = await this.toolService.executeTool(toolName, toolParams);
          toolsUsed.push(toolName);
          
          // Add tool result to conversation history
          conversationHistory.push({
            role: 'assistant',
            content: `Using tool ${toolName} with params: ${JSON.stringify(toolParams)}`
          });
          
          conversationHistory.push({
            role: 'system',
            content: `Tool result: ${JSON.stringify(toolResult)}`
          });
          
          // Continue reasoning with tool result
          continue;
        }
        
        // If no tool call, we have our final response
        finalResponse = llmResponse.content;
        reasoning = false;
      }

      // Update status to responding
      await this.agentExecutionService.updateStatus(
        execution.id, 
        AgentExecutionStatus.RESPONDING, 
        { progress: 90 }
      );

      // Finish execution
      await this.agentExecutionService.finish(execution.id, {
        input: totalInputTokens,
        output: totalOutputTokens
      });

      this.logger.log(`✅ Agent execution completed for session: ${sessionId}`);

      return {
        executionId: execution.id,
        response: finalResponse,
        toolsUsed,
        tokenUsage: {
          input: totalInputTokens,
          output: totalOutputTokens
        },
        status: AgentExecutionStatus.RESPONDING
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Agent execution failed:`, errorMessage);
      
      // Update execution status to error
      await this.agentExecutionService.updateStatus(execution.id, AgentExecutionStatus.ERROR);
      
      throw error;
    }
  }

  private getAvailableToolsForAgent(agent: any): any[] {
    // Get tools based on agent configuration
    const allTools = this.toolService.getAllTools();
    
    // Filter tools based on agent's collection names or specific tool configuration
    // For now, return all tools - in production, this would be more sophisticated
    return allTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  private async buildConversationContext(sessionId: string, context: Message[], newMessage: string): Promise<Message[]> {
    const history: Message[] = [...context];
    
    // Add the new user message
    history.push({
      role: 'user',
      content: newMessage,
      timestamp: new Date()
    });
    
    // Keep only last 10 messages to avoid token limits
    return history.slice(-10);
  }

  private async getMemoryContext(sessionId: string, query: string): Promise<string> {
    try {
      const memoryResults = await this.memoryService.searchChatMemory(sessionId, query, 5);
      const documents = memoryResults?.documents?.[0] || [];
      
      if (documents.length > 0) {
        return `\n\nRelevant past context:\n${documents.map(doc => `- ${doc}`).join('\n')}`;
      }
      
      return '';
    } catch (error) {
      this.logger.warn(`Failed to get memory context: ${error}`);
      return '';
    }
  }

  private buildSystemPrompt(agent: any, tools: any[], memoryContext: string): string {
    let prompt = agent.systemPrompt || 'You are a helpful AI assistant.';
    
    // Add tools information
    if (tools.length > 0) {
      prompt += '\n\nYou have access to the following tools:\n';
      tools.forEach(tool => {
        prompt += `- ${tool.name}: ${tool.description}\n`;
      });
      
      prompt += '\nTo use a tool, respond with JSON in this format: {"tool": "tool_name", "params": {...}}';
      prompt += '\nIf you don\'t need to use any tools, respond normally.';
    }
    
    // Add memory context
    if (memoryContext) {
      prompt += memoryContext;
    }
    
    return prompt;
  }

  private async callLLMWithToolSupport(
    systemPrompt: string, 
    messages: Message[], 
    availableTools: any[]
  ): Promise<{
    content: string;
    toolCall?: { toolName: string; toolParams: any };
    inputTokens?: number;
    outputTokens?: number;
  }> {
    try {
      // Format messages for Bedrock
      const bedrockMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // For now, use a simple approach - call Bedrock and parse response
      // In production, this would use a proper tool-calling LLM
      const response = await this.callBedrockForResponse(systemPrompt, bedrockMessages);
      
      // Check if response contains a tool call (simple JSON parsing)
      const toolCall = this.parseToolCall(response.content);
      
      return {
        content: response.content,
        toolCall,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens
      };
      
    } catch (error) {
      this.logger.error(`LLM call failed: ${error}`);
      throw error;
    }
  }

  private async callBedrockForResponse(
    systemPrompt: string, 
    messages: any[]
  ): Promise<{ content: string; inputTokens?: number; outputTokens?: number }> {
    // This is a simplified implementation
    // In production, you'd use the actual Bedrock converseStream method
    
    // For now, return a mock response
    return {
      content: "I understand your request. Let me help you with that.",
      inputTokens: 100,
      outputTokens: 50
    };
  }

  private parseToolCall(content: string): { toolName: string; toolParams: any } | undefined {
    try {
      // Look for JSON pattern in the response
      const jsonMatch = content.match(/\{[^{}]*"tool"[^{}]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.tool && parsed.params) {
          return {
            toolName: parsed.tool,
            toolParams: parsed.params
          };
        }
      }
      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  // Utility methods for agent management
  async getAgentExecutionStatus(executionId: string) {
    return this.agentExecutionService.updateStatus(executionId, AgentExecutionStatus.IDLE);
  }

  async cancelAgentExecution(executionId: string) {
    return this.agentExecutionService.updateStatus(executionId, AgentExecutionStatus.ERROR);
  }

  async getExecutionHistory(sessionId: string) {
    return this.agentExecutionService.findBySession(sessionId);
  }
} 