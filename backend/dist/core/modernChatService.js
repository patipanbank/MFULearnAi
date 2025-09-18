"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modernChatService = exports.ModernChatService = void 0;
const chat_1 = require("../models/chat");
const websocketManager_1 = require("../utils/websocketManager");
const agentService_1 = require("../services/agentService");
const usageService_1 = require("../services/usageService");
const advancedReasoningAgent_1 = require("./advancedReasoningAgent");
const simplifiedModernAgent_1 = require("./simplifiedModernAgent");
const intentRouter_1 = require("./intentRouter");
const messages_1 = require("@langchain/core/messages");
class ModernChatService {
    constructor() {
        console.log('🚀 Modern Chat Service initialized');
    }
    async createChat(userId, name, agentId) {
        const chat = new chat_1.ChatModel({
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
    async getChat(chatId, userId) {
        console.log(`🔍 Looking for chat: ${chatId} for user: ${userId}`);
        const chat = await chat_1.ChatModel.findOne({ _id: chatId, userId });
        if (chat) {
            console.log(`✅ Found chat: ${chatId}`);
        }
        else {
            console.log(`❌ Chat not found: ${chatId}`);
        }
        return chat;
    }
    async addMessage(chatId, message) {
        const chat = await chat_1.ChatModel.findById(chatId);
        if (!chat) {
            throw new Error(`Chat session ${chatId} not found`);
        }
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const isDuplicate = chat.messages.some(msg => msg.role === message.role &&
            msg.content === message.content &&
            Math.abs(new Date().getTime() - msg.timestamp.getTime()) < 5000);
        if (isDuplicate) {
            console.log(`⚠️ Duplicate message detected and skipped for chat ${chatId}`);
            return chat.messages[chat.messages.length - 1];
        }
        const newMessage = {
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
    async processMessage(chatId, userId, content, images) {
        console.log(`🚀 [MODERN + INTENT] processMessage: chat=${chatId}, user=${userId}`);
        console.log(`🚀 Content: "${content.substring(0, 50)}...", Images: ${images?.length || 0}`);
        try {
            console.log(`💾 Step 1: Saving user message to database...`);
            const userMessage = await this.addMessage(chatId, {
                role: 'user',
                content,
                images
            });
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
            console.log(`🧭 Step 3: Classifying intent and routing...`);
            const chat = await chat_1.ChatModel.findById(chatId);
            const conversationHistory = chat?.messages
                .filter(msg => msg.content.trim() && !msg.isStreaming)
                .slice(-6)
                .map(msg => msg.role === 'user'
                ? new messages_1.HumanMessage(msg.content)
                : new messages_1.AIMessage(msg.content));
            const intentClassification = await intentRouter_1.intentRouter.classifyIntent(content, chatId, conversationHistory);
            console.log(`🎯 Intent: ${intentClassification.primaryIntent} (confidence: ${intentClassification.confidence})`);
            console.log(`🤖 Suggested Agent: ${intentClassification.suggestedAgent}`);
            console.log(`⚙️ Workflow: ${intentClassification.workflowComplexity} (${intentClassification.estimatedSteps} steps)`);
            const routingDecision = await intentRouter_1.intentRouter.routeToAgent(intentClassification);
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
            console.log(`🤖 Step 4: Creating assistant message placeholder...`);
            const assistantMessage = await this.addMessage(chatId, {
                role: 'assistant',
                content: '',
                isStreaming: true
            });
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
            console.log(`🎯 Step 6: Processing with routed agent: ${routingDecision.selectedAgent}`);
            await this.processWithIntentRoutedAgent(chatId, assistantMessage.id, content, intentClassification, routingDecision, images, userId);
        }
        catch (error) {
            console.error('❌ Error in processMessage:', error);
            this.broadcastToChat(chatId, {
                type: 'error',
                data: { message: 'Failed to process message' }
            });
        }
    }
    async processWithIntentRoutedAgent(chatId, assistantMessageId, userContent, intentClassification, routingDecision, images, userId) {
        try {
            console.log(`🧭 processWithIntentRoutedAgent: agent=${routingDecision.selectedAgent}, intent=${intentClassification.primaryIntent}`);
            const chat = await chat_1.ChatModel.findById(chatId);
            if (!chat) {
                throw new Error(`Chat not found: ${chatId}`);
            }
            const agentConfig = await this.buildRoutedAgentConfig(chat, routingDecision, intentClassification, userId);
            const chatHistory = chat.messages
                .filter(msg => msg.content.trim() && !msg.isStreaming)
                .slice(-10)
                .map(msg => msg.role === 'user'
                ? new messages_1.HumanMessage(msg.content)
                : new messages_1.AIMessage(msg.content));
            chatHistory.push(new messages_1.HumanMessage(userContent));
            console.log(`📚 Chat history: ${chatHistory.length} messages`);
            console.log(`🎯 Using agent: ${routingDecision.selectedAgent} with ${routingDecision.executionStrategy} strategy`);
            switch (routingDecision.selectedAgent) {
                case intentRouter_1.AgentType.ADVANCED_REASONING:
                    await this.executeAdvancedReasoningAgent(chatId, assistantMessageId, agentConfig, chatHistory, intentClassification);
                    break;
                case intentRouter_1.AgentType.SIMPLIFIED_MODERN:
                case intentRouter_1.AgentType.GENERAL_ASSISTANT:
                    await this.executeSimplifiedModernAgent(chatId, assistantMessageId, agentConfig, chatHistory, intentClassification);
                    break;
                case intentRouter_1.AgentType.CODE_ASSISTANT:
                case intentRouter_1.AgentType.CREATIVE_WRITER:
                case intentRouter_1.AgentType.RESEARCH_ANALYST:
                case intentRouter_1.AgentType.SPECIALIZED_KNOWLEDGE:
                    if (intentClassification.workflowComplexity === 'complex' || intentClassification.metadata.requiresReasoning) {
                        await this.executeAdvancedReasoningAgent(chatId, assistantMessageId, agentConfig, chatHistory, intentClassification);
                    }
                    else {
                        await this.executeSimplifiedModernAgent(chatId, assistantMessageId, agentConfig, chatHistory, intentClassification);
                    }
                    break;
                default:
                    console.warn(`⚠️ Unknown agent type: ${routingDecision.selectedAgent}, falling back to simplified`);
                    await this.executeSimplifiedModernAgent(chatId, assistantMessageId, agentConfig, chatHistory, intentClassification);
            }
        }
        catch (error) {
            console.error('❌ Error in processWithIntentRoutedAgent:', error);
            await this.updateMessageContent(chatId, assistantMessageId, 'I apologize, but I encountered an error processing your request. Please try again.', false);
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
    async buildRoutedAgentConfig(chat, routingDecision, intentClassification, userId) {
        let baseConfig = {
            modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            sessionId: chat._id?.toString() || '',
            userId: userId || 'unknown',
            ...routingDecision.agentConfig
        };
        if (chat.agentId) {
            try {
                const customAgent = await agentService_1.agentService.getAgentById(chat.agentId);
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
                    baseConfig.useTemplateSystem = true;
                    baseConfig.intent = intentClassification.primaryIntent;
                    baseConfig.workflowComplexity = intentClassification.workflowComplexity;
                    baseConfig.templateContext = {
                        customAgent: customAgent,
                        originalSystemPrompt: customAgent.systemPrompt
                    };
                    baseConfig.systemPrompt = this.buildIntentAwareSystemPrompt(customAgent.systemPrompt || this.getDefaultSystemPromptForIntent(intentClassification.primaryIntent), intentClassification);
                    console.log(`🎯 Using custom agent: ${customAgent.name} with intent-aware configuration`);
                }
            }
            catch (error) {
                console.warn(`⚠️ Failed to get custom agent config:`, error);
            }
        }
        else {
            baseConfig.useTemplateSystem = true;
            baseConfig.intent = intentClassification.primaryIntent;
            baseConfig.workflowComplexity = intentClassification.workflowComplexity;
            baseConfig.templateContext = {};
            baseConfig.systemPrompt = this.buildIntentAwareSystemPrompt(this.getDefaultSystemPromptForIntent(intentClassification.primaryIntent), intentClassification);
        }
        return baseConfig;
    }
    buildIntentAwareSystemPrompt(basePrompt, intentClassification) {
        let enhancedPrompt = basePrompt;
        enhancedPrompt += `\n\n## Current Task Context:
- **Primary Intent**: ${intentClassification.primaryIntent}
- **Task Complexity**: ${intentClassification.workflowComplexity}
- **Estimated Steps**: ${intentClassification.estimatedSteps}
- **Required Capabilities**: `;
        const capabilities = [];
        if (intentClassification.metadata.requiresReasoning)
            capabilities.push('reasoning');
        if (intentClassification.metadata.requiresKnowledge)
            capabilities.push('knowledge search');
        if (intentClassification.metadata.requiresCalculation)
            capabilities.push('calculation');
        if (intentClassification.metadata.requiresCreativity)
            capabilities.push('creativity');
        if (intentClassification.metadata.isFollowUp)
            capabilities.push('context awareness');
        enhancedPrompt += capabilities.join(', ') || 'none specific';
        switch (intentClassification.primaryIntent) {
            case intentRouter_1.TaskIntent.CODE_ASSISTANCE:
                enhancedPrompt += `\n\n## Coding Assistant Guidelines:
- Provide clear, well-commented code examples
- Explain the logic and approach
- Consider best practices and potential issues
- Offer alternative solutions when appropriate`;
                break;
            case intentRouter_1.TaskIntent.MATHEMATICAL_CALCULATION:
                enhancedPrompt += `\n\n## Mathematical Reasoning Guidelines:
- Show step-by-step calculations
- Verify results when possible
- Explain mathematical concepts if needed
- Use appropriate tools for complex calculations`;
                break;
            case intentRouter_1.TaskIntent.RESEARCH_ASSISTANCE:
                enhancedPrompt += `\n\n## Research Assistant Guidelines:
- Search for comprehensive information
- Cite sources when possible
- Present information objectively
- Organize findings clearly`;
                break;
            case intentRouter_1.TaskIntent.CREATIVE_BRAINSTORMING:
            case intentRouter_1.TaskIntent.WRITING_ASSISTANCE:
                enhancedPrompt += `\n\n## Creative Assistant Guidelines:
- Think outside the box
- Provide multiple creative options
- Consider different perspectives
- Balance creativity with practicality`;
                break;
            case intentRouter_1.TaskIntent.PROBLEM_SOLVING:
                enhancedPrompt += `\n\n## Problem-Solving Guidelines:
- Break down complex problems
- Consider multiple approaches
- Analyze pros and cons
- Provide actionable solutions`;
                break;
        }
        if (intentClassification.metadata.requiresReasoning) {
            enhancedPrompt += `\n\n## Reasoning Instructions:
- Use <thinking> tags to show your reasoning process
- Break down complex problems step by step
- Consider multiple perspectives before concluding
- Validate your reasoning at each step`;
        }
        return enhancedPrompt;
    }
    getDefaultSystemPromptForIntent(intent) {
        const basePrompt = "You are an advanced AI assistant with sophisticated reasoning capabilities.";
        switch (intent) {
            case intentRouter_1.TaskIntent.CODE_ASSISTANCE:
            case intentRouter_1.TaskIntent.DEBUGGING_HELP:
            case intentRouter_1.TaskIntent.TECHNICAL_EXPLANATION:
                return `${basePrompt} You specialize in programming, software development, and technical problem-solving. Provide clear, practical coding solutions with detailed explanations.`;
            case intentRouter_1.TaskIntent.ACADEMIC_QUESTION:
            case intentRouter_1.TaskIntent.RESEARCH_ASSISTANCE:
                return `${basePrompt} You specialize in academic research and educational content. Provide thorough, well-researched answers with proper context and citations when possible.`;
            case intentRouter_1.TaskIntent.WRITING_ASSISTANCE:
            case intentRouter_1.TaskIntent.CONTENT_CREATION:
            case intentRouter_1.TaskIntent.CREATIVE_BRAINSTORMING:
                return `${basePrompt} You specialize in creative writing and content creation. Help with ideation, structure, style, and refinement of written content.`;
            case intentRouter_1.TaskIntent.MATHEMATICAL_CALCULATION:
            case intentRouter_1.TaskIntent.PROBLEM_SOLVING:
                return `${basePrompt} You specialize in analytical thinking and problem-solving. Break down complex problems, show clear reasoning, and provide step-by-step solutions.`;
            case intentRouter_1.TaskIntent.DATA_ANALYSIS:
                return `${basePrompt} You specialize in data analysis and interpretation. Help analyze data, identify patterns, and draw meaningful insights.`;
            default:
                return `${basePrompt} Provide helpful, accurate, and well-reasoned responses to user questions. Think step-by-step and use tools intelligently when needed.`;
        }
    }
    async executeAdvancedReasoningAgent(chatId, assistantMessageId, agentConfig, chatHistory, intentClassification) {
        console.log(`🧠 Executing Advanced Reasoning Agent for ${intentClassification.primaryIntent}`);
        let fullContent = '';
        let thinkingContent = '';
        let reasoningSteps = [];
        const modernAgent = await (0, advancedReasoningAgent_1.createAdvancedReasoningAgent)(agentConfig);
        const onStreamingEvent = await this.createAdvancedAgentEventHandler(chatId, assistantMessageId, intentClassification);
        try {
            const response = await modernAgent.run(chatHistory, onStreamingEvent);
            await this.updateMessageContent(chatId, assistantMessageId, response, false);
            const reasoningChain = modernAgent.getReasoningChain();
            this.broadcastToChat(chatId, {
                type: 'message_completed',
                data: {
                    messageId: assistantMessageId,
                    content: response,
                    intent: intentClassification.primaryIntent,
                    agent: intentRouter_1.AgentType.ADVANCED_REASONING,
                    reasoningChain: reasoningChain,
                    tokensUsed: response.length
                }
            });
            console.log(`✅ Advanced Reasoning Agent completed for ${intentClassification.primaryIntent}`);
        }
        catch (error) {
            console.error('❌ Advanced Reasoning Agent failed:', error);
            throw error;
        }
    }
    async executeSimplifiedModernAgent(chatId, assistantMessageId, agentConfig, chatHistory, intentClassification) {
        console.log(`🤖 Executing Simplified Modern Agent for ${intentClassification.primaryIntent}`);
        const modernAgent = await (0, simplifiedModernAgent_1.createSimplifiedModernAgent)(agentConfig);
        const onStreamingEvent = await this.createSimplifiedAgentEventHandler(chatId, assistantMessageId, intentClassification);
        try {
            const response = await modernAgent.run(chatHistory, onStreamingEvent);
            await this.updateMessageContent(chatId, assistantMessageId, response, false);
            this.broadcastToChat(chatId, {
                type: 'message_completed',
                data: {
                    messageId: assistantMessageId,
                    content: response,
                    intent: intentClassification.primaryIntent,
                    agent: intentRouter_1.AgentType.SIMPLIFIED_MODERN,
                    tokensUsed: response.length
                }
            });
            console.log(`✅ Simplified Modern Agent completed for ${intentClassification.primaryIntent}`);
        }
        catch (error) {
            console.error('❌ Simplified Modern Agent failed:', error);
            throw error;
        }
    }
    async processWithModernAgent(chatId, assistantMessageId, userContent, images, userId) {
        try {
            console.log(`🚀 processWithModernAgent: chatId=${chatId}, assistantId=${assistantMessageId}`);
            const chat = await chat_1.ChatModel.findById(chatId);
            if (!chat) {
                throw new Error(`Chat not found: ${chatId}`);
            }
            let agentConfig = {
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
                    const customAgent = await agentService_1.agentService.getAgentById(chat.agentId);
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
                            reasoningMode: 'auto-cot',
                            enableSelfConsistency: true,
                            enableReflection: true
                        };
                        console.log(`🎯 Using custom agent: ${customAgent.name}`);
                    }
                }
                catch (error) {
                    console.warn(`⚠️ Failed to get custom agent config:`, error);
                }
            }
            console.log(`⚙️ Agent config: model=${agentConfig.modelId}, collections=${agentConfig.collectionNames?.length || 0}`);
            const chatHistory = chat.messages
                .filter(msg => msg.content.trim() && !msg.isStreaming)
                .slice(-10)
                .map(msg => msg.role === 'user'
                ? new messages_1.HumanMessage(msg.content)
                : new messages_1.AIMessage(msg.content));
            chatHistory.push(new messages_1.HumanMessage(userContent));
            console.log(`📚 Chat history: ${chatHistory.length} messages`);
            let fullContent = '';
            let thinkingContent = '';
            let finalAnswer = '';
            let isInThinkingMode = false;
            let thinkingComplete = false;
            let inputTokens = 0;
            let outputTokens = 0;
            let reasoningSteps = [];
            let reasoningChain = null;
            const modernAgent = await (0, advancedReasoningAgent_1.createAdvancedReasoningAgent)(agentConfig);
            const onStreamingEvent = async (event) => {
                console.log(`📡 Agent event: ${event.type}`);
                if (event.type === 'thinking') {
                    const thinkingData = event.data.content || '';
                    thinkingContent += thinkingData;
                    await this.updateMessageThinking(chatId, assistantMessageId, thinkingContent, true);
                    this.broadcastToChat(chatId, {
                        type: 'thinking_chunk',
                        data: {
                            messageId: assistantMessageId,
                            thinkingContent: thinkingContent,
                            isThinkingStreaming: true
                        }
                    });
                }
                else if (event.type === 'reasoning_step') {
                    const steps = event.data.steps || [];
                    reasoningSteps.push(...steps);
                    const stepsText = steps.map((step, idx) => `${reasoningSteps.length - steps.length + idx + 1}. ${step.thought}: ${step.action || ''}`).join('\n');
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
                }
                else if (event.type === 'reflection') {
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
                }
                else if (event.type === 'chunk') {
                    const chunkContent = String(event.data.delta || '');
                    const thinkingStartPattern = /<thinking>/i;
                    const thinkingEndPattern = /<\/thinking>/i;
                    if (!isInThinkingMode && thinkingStartPattern.test(chunkContent)) {
                        isInThinkingMode = true;
                        const cleanChunk = chunkContent.replace(thinkingStartPattern, '').trim();
                        if (cleanChunk) {
                            thinkingContent += cleanChunk;
                            await this.updateMessageThinking(chatId, assistantMessageId, thinkingContent, true);
                        }
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
                    if (isInThinkingMode && thinkingEndPattern.test(chunkContent)) {
                        const cleanChunk = chunkContent.replace(thinkingEndPattern, '').trim();
                        if (cleanChunk) {
                            thinkingContent += cleanChunk;
                        }
                        isInThinkingMode = false;
                        thinkingComplete = true;
                        await this.updateMessageThinking(chatId, assistantMessageId, thinkingContent, false);
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
                    if (isInThinkingMode) {
                        thinkingContent += chunkContent;
                        await this.updateMessageThinking(chatId, assistantMessageId, thinkingContent, true);
                        this.broadcastToChat(chatId, {
                            type: 'thinking_chunk',
                            data: {
                                messageId: assistantMessageId,
                                thinkingContent: thinkingContent,
                                isThinkingStreaming: true
                            }
                        });
                    }
                    else if (thinkingComplete || !thinkingContent) {
                        finalAnswer += chunkContent;
                        fullContent = finalAnswer;
                        await this.updateMessageFinalAnswer(chatId, assistantMessageId, finalAnswer);
                        this.broadcastToChat(chatId, {
                            type: 'answer_chunk',
                            data: {
                                messageId: assistantMessageId,
                                finalAnswer: finalAnswer,
                                isStreaming: true
                            }
                        });
                    }
                }
                else if (event.type === 'tool_start') {
                    this.broadcastToChat(chatId, {
                        type: 'tool_start',
                        data: {
                            messageId: assistantMessageId,
                            tool_name: event.data.tool_name,
                            tool_input: event.data.tool_input,
                            reasoning: event.data.reasoning || 'Tool selected based on reasoning analysis'
                        }
                    });
                }
                else if (event.type === 'tool_result') {
                    this.broadcastToChat(chatId, {
                        type: 'tool_result',
                        data: {
                            messageId: assistantMessageId,
                            tool_name: event.data.tool_name,
                            output: event.data.output,
                            reasoningApplied: event.data.reasoning_applied || false
                        }
                    });
                }
                else if (event.type === 'end') {
                    const completeFinalAnswer = String(event.data.answer || finalAnswer || fullContent);
                    inputTokens = event.data.inputTokens || 0;
                    outputTokens = event.data.outputTokens || 0;
                    reasoningChain = event.data.reasoningChain || null;
                    if (thinkingContent && !thinkingComplete) {
                        await this.updateMessageThinking(chatId, assistantMessageId, thinkingContent, false);
                    }
                    await this.updateMessageFinalAnswer(chatId, assistantMessageId, completeFinalAnswer);
                    await this.updateMessageContent(chatId, assistantMessageId, completeFinalAnswer);
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
                    if (userId && (inputTokens || outputTokens)) {
                        await usageService_1.usageService.updateUsage(userId, inputTokens, outputTokens);
                        console.log(`📊 Usage updated: ${inputTokens} input, ${outputTokens} output tokens`);
                    }
                }
                else if (event.type === 'error') {
                    console.error('❌ Agent error:', event.data.error);
                    await this.updateMessageContent(chatId, assistantMessageId, `[Error: ${event.data.error}]`);
                    this.broadcastToChat(chatId, {
                        type: 'message_error',
                        data: {
                            messageId: assistantMessageId,
                            error: event.data.error
                        }
                    });
                }
            };
            console.log(`🤖 Executing Modern Agent...`);
            const result = await modernAgent.run(chatHistory, onStreamingEvent);
            const finalReasoningChain = modernAgent.getReasoningChain();
            console.log(`✅ Advanced Reasoning Agent execution completed:`);
            console.log(`   Result: ${result.substring(0, 100)}...`);
            console.log(`   Reasoning Steps: ${finalReasoningChain?.steps.length || 0}`);
            console.log(`   Confidence: ${finalReasoningChain?.totalConfidence?.toFixed(2) || 'N/A'}`);
        }
        catch (error) {
            console.error('❌ Error in processWithModernAgent:', error);
            const errorMessage = error instanceof Error ? error.message : 'AI processing failed';
            await this.updateMessageContent(chatId, assistantMessageId, `[Error: ${errorMessage}]`);
            this.broadcastToChat(chatId, {
                type: 'message_error',
                data: {
                    messageId: assistantMessageId,
                    error: errorMessage
                }
            });
        }
    }
    async createAdvancedAgentEventHandler(chatId, assistantMessageId, intentClassification) {
        let thinkingContent = '';
        let reasoningSteps = [];
        return async (event) => {
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
                    const stepsText = steps.map((step, idx) => `${reasoningSteps.length - steps.length + idx + 1}. ${step.thought}: ${step.action || ''}`).join('\n');
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
    async createSimplifiedAgentEventHandler(chatId, assistantMessageId, intentClassification) {
        return async (event) => {
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
    async updateMessageContent(chatId, messageId, content, isStreaming = false) {
        await chat_1.ChatModel.updateOne({ _id: chatId, 'messages.id': messageId }, {
            $set: {
                'messages.$.content': content,
                'messages.$.isStreaming': isStreaming,
                updatedAt: new Date()
            }
        });
    }
    async updateMessageThinking(chatId, messageId, thinkingContent, isStreaming) {
        await chat_1.ChatModel.updateOne({ _id: chatId, 'messages.id': messageId }, {
            $set: {
                'messages.$.thinkingContent': thinkingContent,
                'messages.$.isThinkingStreaming': isStreaming,
                'messages.$.isThinkingComplete': !isStreaming,
                updatedAt: new Date()
            }
        });
    }
    async updateMessageFinalAnswer(chatId, messageId, finalAnswer) {
        await chat_1.ChatModel.updateOne({ _id: chatId, 'messages.id': messageId }, {
            $set: {
                'messages.$.finalAnswer': finalAnswer,
                'messages.$.content': finalAnswer,
                'messages.$.isStreaming': false,
                'messages.$.isComplete': true,
                updatedAt: new Date()
            }
        });
    }
    broadcastToChat(chatId, data) {
        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify(data));
        }
    }
    async getUserChats(userId) {
        return chat_1.ChatModel.find({ userId }).sort({ updatedAt: -1 }).exec();
    }
    async deleteChat(chatId, userId) {
        const result = await chat_1.ChatModel.deleteOne({ _id: chatId, userId });
        return result.deletedCount > 0;
    }
    async updateChatName(chatId, userId, name) {
        const result = await chat_1.ChatModel.updateOne({ _id: chatId, userId }, { name, updatedAt: new Date() });
        return result.modifiedCount > 0;
    }
}
exports.ModernChatService = ModernChatService;
exports.modernChatService = new ModernChatService();
//# sourceMappingURL=modernChatService.js.map