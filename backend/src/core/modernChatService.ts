/**
 * 🚀 Modern Chat Service
 *
 * ใช้ Modern Agent System แทนระบบเก่า
 * - เน้น LangChain/LangGraph/LangMem เป็นหลัก
 * - ไม่มี fallback ไป Bedrock โดยตรง
 * - Real-time streaming ผ่าน WebSocket
 * - Simplified architecture
 * - Real embedding service
 */

import { ChatModel, Chat, ChatMessage } from '../models/chat';
import { wsManager } from '../utils/websocketManager';
import { agentService } from '../services/agentService';
import { usageService } from '../services/usageService';
import { createAdvancedReasoningAgent, AdvancedAgentConfig } from './advancedReasoningAgent';
import { createSimplifiedModernAgent, SimplifiedAgentConfig } from './simplifiedModernAgent';
import { intentRouter, TaskIntent, AgentType, IntentClassificationResult, RoutingDecision, WorkflowComplexity } from './intentRouter';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

export class ModernChatService {
  constructor() {
    console.log('🚀 Modern Chat Service initialized');
  }

  public async createChat(userId: string, name: string, agentId?: string): Promise<Chat> {
    const chat = new ChatModel({
      userId,
      name,
      messages: [],
      agentId,
      isPinned: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await chat.save();
    console.log(`✅ Created chat session ${chat._id} for user ${userId}`);
    return chat;
  }

  public async getChat(chatId: string, userId: string): Promise<Chat | null> {
    console.log(`🔍 Looking for chat: ${chatId} for user: ${userId}`);

    const chat = await ChatModel.findOne({ _id: chatId, userId });

    if (chat) {
      console.log(`✅ Found chat: ${chatId}`);
    } else {
      console.log(`❌ Chat not found: ${chatId}`);
    }

    return chat;
  }

  public async addMessage(chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      throw new Error(`Chat session ${chatId} not found`);
    }

    // Generate unique message ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check for duplicate messages (avoid double creation)
    const isDuplicate = chat.messages.some(msg =>
      msg.role === message.role &&
      msg.content === message.content &&
      Math.abs(new Date().getTime() - msg.timestamp.getTime()) < 5000 // Within 5 seconds
    );

    if (isDuplicate) {
      console.log(`⚠️ Duplicate message detected and skipped for chat ${chatId}`);
      return chat.messages[chat.messages.length - 1]; // Return the existing message
    }

    const newMessage: ChatMessage = {
      id: messageId,
      ...message,
      timestamp: new Date()
    };

    chat.messages.push(newMessage);
    chat.updatedAt = new Date();
    await chat.save();

    console.log(`✅ Added message to session ${chatId}:`, messageId);

    return newMessage;
  }

  /**
   * 🌟 Modern Message Processing with Intent Routing
   * - ใช้ Intent Classification และ Smart Agent Selection
   * - Real-time streaming
   * - LangChain/LangGraph/LangMem integration
   * - Adaptive workflow execution
   */
  public async processMessage(chatId: string, userId: string, content: string, images?: Array<{ url: string; mediaType: string }>): Promise<void> {
    console.log(`🚀 [MODERN + INTENT] processMessage: chat=${chatId}, user=${userId}`);
    console.log(`🚀 Content: "${content.substring(0, 50)}...", Images: ${images?.length || 0}`);

    try {
      // Step 1: Save user message to database FIRST
      console.log(`💾 Step 1: Saving user message to database...`);
      const userMessage = await this.addMessage(chatId, {
        role: 'user',
        content,
        images
      });

      // Step 2: Notify frontend about new user message
      console.log(`📡 Step 2: Notifying frontend about user message...`);
      this.broadcastToChat(chatId, {
        type: 'message_added',
        data: {
          message: {
            id: userMessage.id,
            role: 'user',
            content: userMessage.content,
            timestamp: userMessage.timestamp,
            images: userMessage.images
          }
        }
      });

      // Step 3: Intent Classification & Routing Decision
      console.log(`🧭 Step 3: Classifying intent and routing...`);
      const chat = await ChatModel.findById(chatId);
      const conversationHistory = chat?.messages
        .filter(msg => msg.content.trim() && !msg.isStreaming)
        .slice(-6) // Last 6 messages for context
        .map(msg => msg.role === 'user'
          ? new HumanMessage(msg.content)
          : new AIMessage(msg.content)
        );

      // Classify intent using the new Intent Router
      const intentClassification = await intentRouter.classifyIntent(
        content,
        chatId,
        conversationHistory
      );

      console.log(`🎯 Intent: ${intentClassification.primaryIntent} (confidence: ${intentClassification.confidence})`);
      console.log(`🤖 Suggested Agent: ${intentClassification.suggestedAgent}`);
      console.log(`⚙️ Workflow: ${intentClassification.workflowComplexity} (${intentClassification.estimatedSteps} steps)`);

      // Get routing decision
      const routingDecision = await intentRouter.routeToAgent(intentClassification);

      // Broadcast intent analysis to frontend
      this.broadcastToChat(chatId, {
        type: 'intent_classified',
        data: {
          intent: intentClassification.primaryIntent,
          confidence: intentClassification.confidence,
          selectedAgent: routingDecision.selectedAgent,
          workflowComplexity: intentClassification.workflowComplexity,
          estimatedSteps: intentClassification.estimatedSteps,
          reasoning: routingDecision.reasoning
        }
      });

      // Step 4: Create assistant message placeholder
      console.log(`🤖 Step 4: Creating assistant message placeholder...`);
      const assistantMessage = await this.addMessage(chatId, {
        role: 'assistant',
        content: '',
        isStreaming: true
      });

      // Step 5: Notify frontend about new assistant message
      console.log(`📡 Step 5: Notifying frontend about assistant message...`);
      this.broadcastToChat(chatId, {
        type: 'message_added',
        data: {
          message: {
            id: assistantMessage.id,
            role: 'assistant',
            content: '',
            timestamp: assistantMessage.timestamp,
            isStreaming: true
          }
        }
      });

      // Step 6: Process with Intent-Routed Agent System
      console.log(`🎯 Step 6: Processing with routed agent: ${routingDecision.selectedAgent}`);
      await this.processWithIntentRoutedAgent(
        chatId,
        assistantMessage.id,
        content,
        intentClassification,
        routingDecision,
        images,
        userId
      );

    } catch (error) {
      console.error('❌ Error in processMessage:', error);
      this.broadcastToChat(chatId, {
        type: 'error',
        data: { message: 'Failed to process message' }
      });
    }
  }

  /**
   * 🧭 Intent-Routed Agent Processing
   * Processes messages using the appropriate agent based on intent classification
   */
  private async processWithIntentRoutedAgent(
    chatId: string,
    assistantMessageId: string,
    userContent: string,
    intentClassification: IntentClassificationResult,
    routingDecision: RoutingDecision,
    images?: Array<{ url: string; mediaType: string }>,
    userId?: string
  ): Promise<void> {
    try {
      console.log(`🧭 processWithIntentRoutedAgent: agent=${routingDecision.selectedAgent}, intent=${intentClassification.primaryIntent}`);

      // Get chat and agent configuration
      const chat = await ChatModel.findById(chatId);
      if (!chat) {
        throw new Error(`Chat not found: ${chatId}`);
      }

      // Build agent configuration based on routing decision
      const agentConfig = await this.buildRoutedAgentConfig(
        chat,
        routingDecision,
        intentClassification,
        userId
      );

      // Prepare chat history for context
      const chatHistory = chat.messages
        .filter(msg => msg.content.trim() && !msg.isStreaming)
        .slice(-10) // Last 10 messages for context
        .map(msg => msg.role === 'user'
          ? new HumanMessage(msg.content)
          : new AIMessage(msg.content)
        );

      // Add current user message
      chatHistory.push(new HumanMessage(userContent));

      console.log(`📚 Chat history: ${chatHistory.length} messages`);
      console.log(`🎯 Using agent: ${routingDecision.selectedAgent} with ${routingDecision.executionStrategy} strategy`);

      // Execute based on selected agent type
      switch (routingDecision.selectedAgent) {
        case AgentType.ADVANCED_REASONING:
          await this.executeAdvancedReasoningAgent(
            chatId,
            assistantMessageId,
            agentConfig as AdvancedAgentConfig,
            chatHistory,
            intentClassification
          );
          break;

        case AgentType.SIMPLIFIED_MODERN:
        case AgentType.GENERAL_ASSISTANT:
          await this.executeSimplifiedModernAgent(
            chatId,
            assistantMessageId,
            agentConfig as SimplifiedAgentConfig,
            chatHistory,
            intentClassification
          );
          break;

        case AgentType.CODE_ASSISTANT:
        case AgentType.CREATIVE_WRITER:
        case AgentType.RESEARCH_ANALYST:
        case AgentType.SPECIALIZED_KNOWLEDGE:
          // Use appropriate agent based on intent
          if (intentClassification.workflowComplexity === 'complex' || intentClassification.metadata.requiresReasoning) {
            await this.executeAdvancedReasoningAgent(
              chatId,
              assistantMessageId,
              agentConfig as AdvancedAgentConfig,
              chatHistory,
              intentClassification
            );
          } else {
            await this.executeSimplifiedModernAgent(
              chatId,
              assistantMessageId,
              agentConfig as SimplifiedAgentConfig,
              chatHistory,
              intentClassification
            );
          }
          break;

        default:
          console.warn(`⚠️ Unknown agent type: ${routingDecision.selectedAgent}, falling back to simplified`);
          await this.executeSimplifiedModernAgent(
            chatId,
            assistantMessageId,
            agentConfig as SimplifiedAgentConfig,
            chatHistory,
            intentClassification
          );
      }

    } catch (error) {
      console.error('❌ Error in processWithIntentRoutedAgent:', error);

      // Update message with error
      await this.updateMessageContent(chatId, assistantMessageId,
        'I apologize, but I encountered an error processing your request. Please try again.', false);

      this.broadcastToChat(chatId, {
        type: 'error',
        data: {
          messageId: assistantMessageId,
          message: 'Agent processing failed',
          intent: intentClassification.primaryIntent,
          agent: routingDecision.selectedAgent
        }
      });
    }
  }

  /**
   * Build agent configuration based on routing decision
   */
  private async buildRoutedAgentConfig(
    chat: Chat,
    routingDecision: RoutingDecision,
    intentClassification: IntentClassificationResult,
    userId?: string
  ): Promise<AdvancedAgentConfig | SimplifiedAgentConfig> {
    // Base configuration from routing decision
    let baseConfig = {
      modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      sessionId: chat._id?.toString() || '',
      userId: userId || 'unknown',
      ...routingDecision.agentConfig
    };

    // Apply custom agent configuration if specified
    if (chat.agentId) {
      try {
        const customAgent = await agentService.getAgentById(chat.agentId);
        if (customAgent) {
          baseConfig = {
            ...baseConfig,
            modelId: customAgent.modelId || baseConfig.modelId,
            temperature: customAgent.temperature || baseConfig.temperature,
            maxTokens: customAgent.maxTokens || baseConfig.maxTokens,
            collectionNames: customAgent.collectionNames || [],
            agentTools: customAgent.tools || [],
            agentId: chat.agentId
          };

          // Enable template system and set context
          baseConfig.useTemplateSystem = true;
          baseConfig.intent = intentClassification.primaryIntent;
          baseConfig.workflowComplexity = intentClassification.workflowComplexity as WorkflowComplexity;
          baseConfig.templateContext = {
            customAgent: customAgent,
            originalSystemPrompt: customAgent.systemPrompt
          };

          // Fallback system prompt (used only if template system fails)
          baseConfig.systemPrompt = this.buildIntentAwareSystemPrompt(
            customAgent.systemPrompt || this.getDefaultSystemPromptForIntent(intentClassification.primaryIntent),
            intentClassification
          );

          console.log(`🎯 Using custom agent: ${customAgent.name} with intent-aware configuration`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to get custom agent config:`, error);
      }
    } else {
      // Enable template system for default configuration
      baseConfig.useTemplateSystem = true;
      baseConfig.intent = intentClassification.primaryIntent;
      baseConfig.workflowComplexity = intentClassification.workflowComplexity as WorkflowComplexity;
      baseConfig.templateContext = {};

      // Fallback system prompt (used only if template system fails)
      baseConfig.systemPrompt = this.buildIntentAwareSystemPrompt(
        this.getDefaultSystemPromptForIntent(intentClassification.primaryIntent),
        intentClassification
      );
    }

    return baseConfig;
  }

  /**
   * Build intent-aware system prompt
   */
  private buildIntentAwareSystemPrompt(basePrompt: string, intentClassification: IntentClassificationResult): string {
    let enhancedPrompt = basePrompt;

    // Add intent-specific instructions
    enhancedPrompt += `\n\n## Current Task Context:
- **Primary Intent**: ${intentClassification.primaryIntent}
- **Task Complexity**: ${intentClassification.workflowComplexity}
- **Estimated Steps**: ${intentClassification.estimatedSteps}
- **Required Capabilities**: `;

    const capabilities = [];
    if (intentClassification.metadata.requiresReasoning) capabilities.push('reasoning');
    if (intentClassification.metadata.requiresKnowledge) capabilities.push('knowledge search');
    if (intentClassification.metadata.requiresCalculation) capabilities.push('calculation');
    if (intentClassification.metadata.requiresCreativity) capabilities.push('creativity');
    if (intentClassification.metadata.isFollowUp) capabilities.push('context awareness');

    enhancedPrompt += capabilities.join(', ') || 'none specific';

    // Add intent-specific guidance
    switch (intentClassification.primaryIntent) {
      case TaskIntent.CODE_ASSISTANCE:
        enhancedPrompt += `\n\n## Coding Assistant Guidelines:
- Provide clear, well-commented code examples
- Explain the logic and approach
- Consider best practices and potential issues
- Offer alternative solutions when appropriate`;
        break;

      case TaskIntent.MATHEMATICAL_CALCULATION:
        enhancedPrompt += `\n\n## Mathematical Reasoning Guidelines:
- Show step-by-step calculations
- Verify results when possible
- Explain mathematical concepts if needed
- Use appropriate tools for complex calculations`;
        break;

      case TaskIntent.RESEARCH_ASSISTANCE:
        enhancedPrompt += `\n\n## Research Assistant Guidelines:
- Search for comprehensive information
- Cite sources when possible
- Present information objectively
- Organize findings clearly`;
        break;

      case TaskIntent.CREATIVE_BRAINSTORMING:
      case TaskIntent.WRITING_ASSISTANCE:
        enhancedPrompt += `\n\n## Creative Assistant Guidelines:
- Think outside the box
- Provide multiple creative options
- Consider different perspectives
- Balance creativity with practicality`;
        break;

      case TaskIntent.PROBLEM_SOLVING:
        enhancedPrompt += `\n\n## Problem-Solving Guidelines:
- Break down complex problems
- Consider multiple approaches
- Analyze pros and cons
- Provide actionable solutions`;
        break;
    }

    // Add reasoning instructions if needed
    if (intentClassification.metadata.requiresReasoning) {
      enhancedPrompt += `\n\n## Reasoning Instructions:
- Use <thinking> tags to show your reasoning process
- Break down complex problems step by step
- Consider multiple perspectives before concluding
- Validate your reasoning at each step`;
    }

    return enhancedPrompt;
  }

  /**
   * Get default system prompt for specific intent
   */
  private getDefaultSystemPromptForIntent(intent: TaskIntent): string {
    const basePrompt = "You are an advanced AI assistant with sophisticated reasoning capabilities.";

    switch (intent) {
      case TaskIntent.CODE_ASSISTANCE:
      case TaskIntent.DEBUGGING_HELP:
      case TaskIntent.TECHNICAL_EXPLANATION:
        return `${basePrompt} You specialize in programming, software development, and technical problem-solving. Provide clear, practical coding solutions with detailed explanations.`;

      case TaskIntent.ACADEMIC_QUESTION:
      case TaskIntent.RESEARCH_ASSISTANCE:
        return `${basePrompt} You specialize in academic research and educational content. Provide thorough, well-researched answers with proper context and citations when possible.`;

      case TaskIntent.WRITING_ASSISTANCE:
      case TaskIntent.CONTENT_CREATION:
      case TaskIntent.CREATIVE_BRAINSTORMING:
        return `${basePrompt} You specialize in creative writing and content creation. Help with ideation, structure, style, and refinement of written content.`;

      case TaskIntent.MATHEMATICAL_CALCULATION:
      case TaskIntent.PROBLEM_SOLVING:
        return `${basePrompt} You specialize in analytical thinking and problem-solving. Break down complex problems, show clear reasoning, and provide step-by-step solutions.`;

      case TaskIntent.DATA_ANALYSIS:
        return `${basePrompt} You specialize in data analysis and interpretation. Help analyze data, identify patterns, and draw meaningful insights.`;

      default:
        return `${basePrompt} Provide helpful, accurate, and well-reasoned responses to user questions. Think step-by-step and use tools intelligently when needed.`;
    }
  }

  /**
   * Execute Advanced Reasoning Agent
   */
  private async executeAdvancedReasoningAgent(
    chatId: string,
    assistantMessageId: string,
    agentConfig: AdvancedAgentConfig,
    chatHistory: any[],
    intentClassification: IntentClassificationResult
  ): Promise<void> {
    console.log(`🧠 Executing Advanced Reasoning Agent for ${intentClassification.primaryIntent}`);

    // Track streaming content
    let fullContent = '';
    let thinkingContent = '';
    let reasoningSteps: any[] = [];

    // Create Advanced Reasoning Agent
    const modernAgent = await createAdvancedReasoningAgent(agentConfig);

    // Setup event handlers for real-time updates
    const onStreamingEvent = await this.createAdvancedAgentEventHandler(
      chatId,
      assistantMessageId,
      intentClassification
    );

    try {
      // Execute agent
      const response = await modernAgent.run(chatHistory, onStreamingEvent);

      // Final update
      await this.updateMessageContent(chatId, assistantMessageId, response, false);

      // Get reasoning chain for additional context
      const reasoningChain = modernAgent.getReasoningChain();

      // Broadcast completion
      this.broadcastToChat(chatId, {
        type: 'message_completed',
        data: {
          messageId: assistantMessageId,
          content: response,
          intent: intentClassification.primaryIntent,
          agent: AgentType.ADVANCED_REASONING,
          reasoningChain: reasoningChain,
          tokensUsed: response.length // Approximate
        }
      });

      console.log(`✅ Advanced Reasoning Agent completed for ${intentClassification.primaryIntent}`);

    } catch (error) {
      console.error('❌ Advanced Reasoning Agent failed:', error);
      throw error;
    }
  }

  /**
   * Execute Simplified Modern Agent
   */
  private async executeSimplifiedModernAgent(
    chatId: string,
    assistantMessageId: string,
    agentConfig: SimplifiedAgentConfig,
    chatHistory: any[],
    intentClassification: IntentClassificationResult
  ): Promise<void> {
    console.log(`🤖 Executing Simplified Modern Agent for ${intentClassification.primaryIntent}`);

    // Create Simplified Modern Agent
    const modernAgent = await createSimplifiedModernAgent(agentConfig);

    // Setup event handlers
    const onStreamingEvent = await this.createSimplifiedAgentEventHandler(
      chatId,
      assistantMessageId,
      intentClassification
    );

    try {
      // Execute agent
      const response = await modernAgent.run(chatHistory, onStreamingEvent);

      // Final update
      await this.updateMessageContent(chatId, assistantMessageId, response, false);

      // Broadcast completion
      this.broadcastToChat(chatId, {
        type: 'message_completed',
        data: {
          messageId: assistantMessageId,
          content: response,
          intent: intentClassification.primaryIntent,
          agent: AgentType.SIMPLIFIED_MODERN,
          tokensUsed: response.length // Approximate
        }
      });

      console.log(`✅ Simplified Modern Agent completed for ${intentClassification.primaryIntent}`);

    } catch (error) {
      console.error('❌ Simplified Modern Agent failed:', error);
      throw error;
    }
  }

  /**
   * Legacy Modern Agent Processing (kept for compatibility)
   */
  private async processWithModernAgent(
    chatId: string,
    assistantMessageId: string,
    userContent: string,
    images?: Array<{ url: string; mediaType: string }>,
    userId?: string
  ): Promise<void> {
    try {
      console.log(`🚀 processWithModernAgent: chatId=${chatId}, assistantId=${assistantMessageId}`);

      // Get chat and agent configuration
      const chat = await ChatModel.findById(chatId);
      if (!chat) {
        throw new Error(`Chat not found: ${chatId}`);
      }

      // Prepare advanced agent configuration with reasoning
      let agentConfig: AdvancedAgentConfig = {
        modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        systemPrompt: "You are an advanced AI assistant with sophisticated reasoning capabilities. Think step-by-step, analyze problems deeply, and use tools intelligently to provide accurate and well-reasoned responses.",
        sessionId: chatId,
        userId: userId || 'unknown',
        temperature: 0.7,
        maxTokens: 4000,
        maxIterations: 5,
        reasoningMode: 'auto-cot',
        enableSelfConsistency: true,
        enableReflection: true
      };

      if (chat.agentId) {
        try {
          const customAgent = await agentService.getAgentById(chat.agentId);
          if (customAgent) {
            agentConfig = {
              ...agentConfig,
              modelId: customAgent.modelId,
              systemPrompt: customAgent.systemPrompt || agentConfig.systemPrompt,
              temperature: customAgent.temperature || 0.7,
              maxTokens: customAgent.maxTokens || 4000,
              collectionNames: customAgent.collectionNames || [],
              agentTools: customAgent.tools || [],
              agentId: chat.agentId,
              reasoningMode: 'auto-cot', // Enhanced reasoning for custom agents
              enableSelfConsistency: true,
              enableReflection: true
            };
            console.log(`🎯 Using custom agent: ${customAgent.name}`);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to get custom agent config:`, error);
        }
      }

      console.log(`⚙️ Agent config: model=${agentConfig.modelId}, collections=${agentConfig.collectionNames?.length || 0}`);

      // Prepare chat history for context
      const chatHistory = chat.messages
        .filter(msg => msg.content.trim() && !msg.isStreaming)
        .slice(-10) // Last 10 messages for context
        .map(msg => msg.role === 'user'
          ? new HumanMessage(msg.content)
          : new AIMessage(msg.content)
        );

      // Add current user message
      chatHistory.push(new HumanMessage(userContent));

      console.log(`📚 Chat history: ${chatHistory.length} messages`);

      // Track streaming content with new flow: thinking first, then final answer
      let fullContent = '';
      let thinkingContent = '';
      let finalAnswer = '';
      let isInThinkingMode = false;
      let thinkingComplete = false;
      let inputTokens = 0;
      let outputTokens = 0;
      let reasoningSteps: any[] = [];
      let reasoningChain: any = null;

      // Create Advanced Reasoning Agent
      const modernAgent = await createAdvancedReasoningAgent(agentConfig);

      // Setup event handlers for real-time updates
      const onStreamingEvent = async (event: { type: string; data: any }) => {
        console.log(`📡 Agent event: ${event.type}`);

        if (event.type === 'thinking') {
          // Handle reasoning thinking events - immediate thinking broadcast
          const thinkingData = event.data.content || '';
          thinkingContent += thinkingData;

          // Update message with thinking content immediately
          await this.updateMessageThinking(chatId, assistantMessageId, thinkingContent, true);

          this.broadcastToChat(chatId, {
            type: 'thinking_chunk',
            data: {
              messageId: assistantMessageId,
              thinkingContent: thinkingContent,
              isThinkingStreaming: true
            }
          });

        } else if (event.type === 'reasoning_step') {
          // Handle reasoning step events - add to thinking content
          const steps = event.data.steps || [];
          reasoningSteps.push(...steps);

          // Add structured steps to thinking content
          const stepsText = steps.map((step: any, idx: number) =>
            `${reasoningSteps.length - steps.length + idx + 1}. ${step.thought}: ${step.action || ''}`
          ).join('\n');

          if (stepsText) {
            thinkingContent += (thinkingContent ? '\n\n' : '') + stepsText;
            await this.updateMessageThinking(chatId, assistantMessageId, thinkingContent, true);
          }

          this.broadcastToChat(chatId, {
            type: 'reasoning_step',
            data: {
              messageId: assistantMessageId,
              steps: steps,
              totalSteps: reasoningSteps.length,
              thinkingContent: thinkingContent
            }
          });

        } else if (event.type === 'reflection') {
          // Handle self-reflection events - add to thinking content
          const reflection = event.data.reflection || '';
          if (reflection) {
            thinkingContent += (thinkingContent ? '\n\n' : '') + '🤔 ' + reflection;
            await this.updateMessageThinking(chatId, assistantMessageId, thinkingContent, true);
          }

          this.broadcastToChat(chatId, {
            type: 'reasoning_reflection',
            data: {
              messageId: assistantMessageId,
              reflection: reflection,
              thinkingContent: thinkingContent
            }
          });

        } else if (event.type === 'chunk') {
          const chunkContent = String(event.data.delta || '');

          // Detect structured thinking patterns
          const thinkingStartPattern = /<thinking>/i;
          const thinkingEndPattern = /<\/thinking>/i;

          // Check if entering thinking mode
          if (!isInThinkingMode && thinkingStartPattern.test(chunkContent)) {
            isInThinkingMode = true;
            const cleanChunk = chunkContent.replace(thinkingStartPattern, '').trim();
            if (cleanChunk) {
              thinkingContent += cleanChunk;
              await this.updateMessageThinking(chatId, assistantMessageId, thinkingContent, true);
            }

            // Broadcast thinking start
            this.broadcastToChat(chatId, {
              type: 'thinking_start',
              data: {
                messageId: assistantMessageId,
                thinkingContent: thinkingContent,
                isThinkingStreaming: true
              }
            });
            return;
          }

          // Check if exiting thinking mode
          if (isInThinkingMode && thinkingEndPattern.test(chunkContent)) {
            const cleanChunk = chunkContent.replace(thinkingEndPattern, '').trim();
            if (cleanChunk) {
              thinkingContent += cleanChunk;
            }
            isInThinkingMode = false;
            thinkingComplete = true;

            // Final thinking update
            await this.updateMessageThinking(chatId, assistantMessageId, thinkingContent, false);

            // Broadcast thinking complete
            this.broadcastToChat(chatId, {
              type: 'thinking_complete',
              data: {
                messageId: assistantMessageId,
                thinkingContent: thinkingContent,
                isThinkingStreaming: false
              }
            });
            return;
          }

          // Route content to thinking or final answer
          if (isInThinkingMode) {
            thinkingContent += chunkContent;
            await this.updateMessageThinking(chatId, assistantMessageId, thinkingContent, true);

            // Broadcast thinking update
            this.broadcastToChat(chatId, {
              type: 'thinking_chunk',
              data: {
                messageId: assistantMessageId,
                thinkingContent: thinkingContent,
                isThinkingStreaming: true
              }
            });
          } else if (thinkingComplete || !thinkingContent) {
            // This is final answer content
            finalAnswer += chunkContent;
            fullContent = finalAnswer; // For backward compatibility

            // Update database with final answer
            await this.updateMessageFinalAnswer(chatId, assistantMessageId, finalAnswer);

            // Broadcast final answer update
            this.broadcastToChat(chatId, {
              type: 'answer_chunk',
              data: {
                messageId: assistantMessageId,
                finalAnswer: finalAnswer,
                isStreaming: true
              }
            });
          }

        } else if (event.type === 'tool_start') {
          this.broadcastToChat(chatId, {
            type: 'tool_start',
            data: {
              messageId: assistantMessageId,
              tool_name: event.data.tool_name,
              tool_input: event.data.tool_input,
              reasoning: event.data.reasoning || 'Tool selected based on reasoning analysis'
            }
          });

        } else if (event.type === 'tool_result') {
          this.broadcastToChat(chatId, {
            type: 'tool_result',
            data: {
              messageId: assistantMessageId,
              tool_name: event.data.tool_name,
              output: event.data.output,
              reasoningApplied: event.data.reasoning_applied || false
            }
          });

        } else if (event.type === 'end') {
          const completeFinalAnswer = String(event.data.answer || finalAnswer || fullContent);
          inputTokens = event.data.inputTokens || 0;
          outputTokens = event.data.outputTokens || 0;
          reasoningChain = event.data.reasoningChain || null;

          // Final updates to database
          if (thinkingContent && !thinkingComplete) {
            await this.updateMessageThinking(chatId, assistantMessageId, thinkingContent, false);
          }

          await this.updateMessageFinalAnswer(chatId, assistantMessageId, completeFinalAnswer);
          await this.updateMessageContent(chatId, assistantMessageId, completeFinalAnswer);

          // Mark as completed with full reasoning information
          this.broadcastToChat(chatId, {
            type: 'message_completed',
            data: {
              messageId: assistantMessageId,
              thinkingContent: thinkingContent,
              finalAnswer: completeFinalAnswer,
              content: completeFinalAnswer,
              reasoningChain: reasoningChain,
              reasoningSteps: reasoningSteps.length,
              iterations: event.data.iterations || 1
            }
          });

          // Update usage if provided
          if (userId && (inputTokens || outputTokens)) {
            await usageService.updateUsage(
              userId,
              inputTokens,
              outputTokens
            );
            console.log(`📊 Usage updated: ${inputTokens} input, ${outputTokens} output tokens`);
          }

        } else if (event.type === 'error') {
          console.error('❌ Agent error:', event.data.error);

          await this.updateMessageContent(
            chatId,
            assistantMessageId,
            `[Error: ${event.data.error}]`
          );

          this.broadcastToChat(chatId, {
            type: 'message_error',
            data: {
              messageId: assistantMessageId,
              error: event.data.error
            }
          });
        }
      };

      // Execute Modern Agent
      console.log(`🤖 Executing Modern Agent...`);
      const result = await modernAgent.run(chatHistory, onStreamingEvent);

      // Get final reasoning chain for logging
      const finalReasoningChain = modernAgent.getReasoningChain();

      console.log(`✅ Advanced Reasoning Agent execution completed:`);
      console.log(`   Result: ${result.substring(0, 100)}...`);
      console.log(`   Reasoning Steps: ${finalReasoningChain?.steps.length || 0}`);
      console.log(`   Confidence: ${finalReasoningChain?.totalConfidence?.toFixed(2) || 'N/A'}`);

    } catch (error) {
      console.error('❌ Error in processWithModernAgent:', error);
      const errorMessage = error instanceof Error ? error.message : 'AI processing failed';

      // Mark message as failed
      await this.updateMessageContent(
        chatId,
        assistantMessageId,
        `[Error: ${errorMessage}]`
      );

      this.broadcastToChat(chatId, {
        type: 'message_error',
        data: {
          messageId: assistantMessageId,
          error: errorMessage
        }
      });
    }
  }

  /**
   * Create Advanced Agent Event Handler
   */
  private async createAdvancedAgentEventHandler(
    chatId: string,
    assistantMessageId: string,
    intentClassification: IntentClassificationResult
  ): Promise<(event: { type: string; data: any }) => Promise<void>> {
    let thinkingContent = '';
    let reasoningSteps: any[] = [];

    return async (event: { type: string; data: any }) => {
      console.log(`📡 Advanced Agent event: ${event.type}`);

      switch (event.type) {
        case 'thinking':
          const thinkingData = event.data.content || '';
          thinkingContent += thinkingData;
          await this.updateMessageThinking(chatId, assistantMessageId, thinkingContent, true);
          this.broadcastToChat(chatId, {
            type: 'thinking_chunk',
            data: {
              messageId: assistantMessageId,
              thinkingContent: thinkingContent,
              isThinkingStreaming: true,
              intent: intentClassification.primaryIntent
            }
          });
          break;

        case 'reasoning_step':
          const steps = event.data.steps || [];
          reasoningSteps.push(...steps);
          const stepsText = steps.map((step: any, idx: number) =>
            `${reasoningSteps.length - steps.length + idx + 1}. ${step.thought}: ${step.action || ''}`
          ).join('\n');
          if (stepsText) {
            thinkingContent += (thinkingContent ? '\n\n' : '') + stepsText;
            await this.updateMessageThinking(chatId, assistantMessageId, thinkingContent, true);
          }
          this.broadcastToChat(chatId, {
            type: 'reasoning_step',
            data: {
              messageId: assistantMessageId,
              steps: steps,
              totalSteps: reasoningSteps.length,
              thinkingContent: thinkingContent,
              intent: intentClassification.primaryIntent
            }
          });
          break;

        case 'reflection':
          const reflection = event.data.reflection || '';
          if (reflection) {
            thinkingContent += (thinkingContent ? '\n\n' : '') + '🤔 ' + reflection;
            await this.updateMessageThinking(chatId, assistantMessageId, thinkingContent, true);
          }
          this.broadcastToChat(chatId, {
            type: 'reasoning_reflection',
            data: {
              messageId: assistantMessageId,
              reflection: reflection,
              thinkingContent: thinkingContent,
              intent: intentClassification.primaryIntent
            }
          });
          break;

        case 'chunk':
          const chunkContent = String(event.data.delta || '');
          this.broadcastToChat(chatId, {
            type: 'chunk',
            data: {
              messageId: assistantMessageId,
              delta: chunkContent,
              intent: intentClassification.primaryIntent
            }
          });
          break;

        case 'tool_start':
          this.broadcastToChat(chatId, {
            type: 'tool_start',
            data: {
              messageId: assistantMessageId,
              tool_name: event.data.tool_name,
              tool_input: event.data.tool_input,
              intent: intentClassification.primaryIntent
            }
          });
          break;

        case 'tool_result':
          this.broadcastToChat(chatId, {
            type: 'tool_result',
            data: {
              messageId: assistantMessageId,
              tool_name: event.data.tool_name,
              output: event.data.output,
              intent: intentClassification.primaryIntent
            }
          });
          break;
      }
    };
  }

  /**
   * Create Simplified Agent Event Handler
   */
  private async createSimplifiedAgentEventHandler(
    chatId: string,
    assistantMessageId: string,
    intentClassification: IntentClassificationResult
  ): Promise<(event: { type: string; data: any }) => Promise<void>> {
    return async (event: { type: string; data: any }) => {
      console.log(`📡 Simplified Agent event: ${event.type}`);

      switch (event.type) {
        case 'chunk':
          const chunkContent = String(event.data.delta || '');
          this.broadcastToChat(chatId, {
            type: 'chunk',
            data: {
              messageId: assistantMessageId,
              delta: chunkContent,
              intent: intentClassification.primaryIntent
            }
          });
          break;

        case 'tool_start':
          this.broadcastToChat(chatId, {
            type: 'tool_start',
            data: {
              messageId: assistantMessageId,
              tool_name: event.data.tool_name,
              tool_input: event.data.tool_input,
              intent: intentClassification.primaryIntent
            }
          });
          break;

        case 'tool_result':
          this.broadcastToChat(chatId, {
            type: 'tool_result',
            data: {
              messageId: assistantMessageId,
              tool_name: event.data.tool_name,
              output: event.data.output,
              intent: intentClassification.primaryIntent
            }
          });
          break;
      }
    };
  }

  /**
   * Helper to update message content in database (with streaming support)
   */
  private async updateMessageContent(chatId: string, messageId: string, content: string, isStreaming: boolean = false): Promise<void> {
    await ChatModel.updateOne(
      { _id: chatId, 'messages.id': messageId },
      {
        $set: {
          'messages.$.content': content,
          'messages.$.isStreaming': isStreaming,
          updatedAt: new Date()
        }
      }
    );
  }

  /**
   * Helper to update thinking content in database
   */
  private async updateMessageThinking(chatId: string, messageId: string, thinkingContent: string, isStreaming: boolean): Promise<void> {
    await ChatModel.updateOne(
      { _id: chatId, 'messages.id': messageId },
      {
        $set: {
          'messages.$.thinkingContent': thinkingContent,
          'messages.$.isThinkingStreaming': isStreaming,
          'messages.$.isThinkingComplete': !isStreaming,
          updatedAt: new Date()
        }
      }
    );
  }

  /**
   * Helper to update final answer in database
   */
  private async updateMessageFinalAnswer(chatId: string, messageId: string, finalAnswer: string): Promise<void> {
    await ChatModel.updateOne(
      { _id: chatId, 'messages.id': messageId },
      {
        $set: {
          'messages.$.finalAnswer': finalAnswer,
          'messages.$.content': finalAnswer, // Maintain backward compatibility
          'messages.$.isStreaming': false,
          'messages.$.isComplete': true,
          updatedAt: new Date()
        }
      }
    );
  }

  /**
   * Simplified broadcast helper
   */
  private broadcastToChat(chatId: string, data: any): void {
    if (wsManager.getSessionConnectionCount(chatId) > 0) {
      wsManager.broadcastToSession(chatId, JSON.stringify(data));
    }
  }

  // Legacy methods for compatibility
  public async getUserChats(userId: string): Promise<Chat[]> {
    return ChatModel.find({ userId }).sort({ updatedAt: -1 }).exec();
  }

  public async deleteChat(chatId: string, userId: string): Promise<boolean> {
    const result = await ChatModel.deleteOne({ _id: chatId, userId });
    return result.deletedCount > 0;
  }

  public async updateChatName(chatId: string, userId: string, name: string): Promise<boolean> {
    const result = await ChatModel.updateOne(
      { _id: chatId, userId },
      { name, updatedAt: new Date() }
    );
    return result.modifiedCount > 0;
  }
}

export const modernChatService = new ModernChatService();