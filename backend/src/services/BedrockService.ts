import { bedrockClient } from '../bedrock/client';
import {
    ConverseCommand,
    ConverseStreamCommand,
    BedrockRuntimeClient
} from '@aws-sdk/client-bedrock-runtime';
import {
    validateModel,
    normalizeMessages,
    MODELS,
    AVAILABLE_MODELS,
    GUARDRAIL_ID,
    GUARDRAIL_VERSION,
    ENABLE_PROMPT_CACHE,
    CACHE_SUPPORTED_MODELS
} from '../bedrock/text/utils';
import { ChatMessage } from '../../../shared/types';
import { LoggerService } from './LoggerService';

export class BedrockService {

    static async getModels() {
        // Return dynamic model list + environment info
        const ENV_TYPE = process.env.ENV_TYPE || 'TEST';
        return {
            models: AVAILABLE_MODELS.map(m => m.id),
            modelConfigs: AVAILABLE_MODELS, // Optional: send full config if frontend needs it
            environment: ENV_TYPE
        };
    }

    static async sendChat(
        modelId: string,
        messages: ChatMessage[],
        system?: string | Array<{ text: string }>,
        temperature: number = 0.5,
        toolConfig?: any,
        guardrailConfig?: any
    ): Promise<{ text: string, usage: any, stopReason?: string, cacheUsage?: any, guardrailTrace?: any }> {
        const finalModelId = validateModel(modelId);

        // Normalize System Prompt
        let finalSystem: any[] | undefined;
        if (system) {
            if (Array.isArray(system)) {
                finalSystem = system.map((block: any) => (
                    typeof block === 'string' ? { text: block } : block
                ));
            } else if (typeof system === 'string') {
                finalSystem = [{ text: system }];
            }
        }

        // Normalize Messages
        const formattedMessages = normalizeMessages(messages.filter(msg => msg.role !== 'system'));

        // Guardrails
        let finalGuardrailConfig = guardrailConfig;
        if (!finalGuardrailConfig && GUARDRAIL_ID) {
            finalGuardrailConfig = {
                guardrailIdentifier: GUARDRAIL_ID,
                guardrailVersion: GUARDRAIL_VERSION
            };
        }

        const input: any = {
            modelId: finalModelId,
            messages: formattedMessages,
            system: finalSystem,
            inferenceConfig: { maxTokens: 4096, temperature },
            toolConfig
        };
        if (finalGuardrailConfig) input.guardrailConfig = finalGuardrailConfig;

        try {
            LoggerService.info('bedrock_sendchat_internal', { modelId: finalModelId });

            const command = new ConverseCommand(input);
            const response = await bedrockClient.send(command);

            const outputMessage = response.output?.message;
            const stopReason = response.stopReason;
            const usage = response.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

            let content = '';
            // Robust content extraction similar to legacy
            if (stopReason === 'tool_use' || (outputMessage?.content && outputMessage.content.length > 0)) {
                // For now, Orchestrator expects 'text' string if it's text, or JSON string of content array if complex?
                // Legacy BedrockService.sendChat returned `text` which could be a JSON string of content array in some cases.
                // Let's match legacy behavior:
                if (stopReason === 'tool_use' || outputMessage?.content?.some(b => b.toolUse)) {
                    content = JSON.stringify(outputMessage?.content);
                } else if (outputMessage?.content) {
                    // Extract text from text blocks
                    content = outputMessage.content.filter(b => b.text).map(b => b.text).join('') || '';
                    if (!content) content = JSON.stringify(outputMessage.content); // Fallback
                }
            }

            const mappedUsage = {
                input: usage.inputTokens || 0,
                output: usage.outputTokens || 0,
                total: usage.totalTokens || 0
            };

            return {
                text: content,
                usage: mappedUsage,
                stopReason: stopReason,
                cacheUsage: (response as any).cacheUsage,
                guardrailTrace: (response as any).trace?.guardrail
            };

        } catch (error: any) {
            LoggerService.error('bedrock_sendchat_internal_error', { error: error.message });
            throw error;
        }
    }
    /**
     * Stream chat response token-by-token via callback.
     * Emits deltas through the provided `onDelta` callback (routed to Socket.IO by AgentWorkflow).
     */
    static async streamWithCallback(
        modelId: string,
        messages: ChatMessage[],
        onDelta: (delta: string) => void,
        temperature: number = 0.5,
        toolConfig?: any,
        guardrailConfig?: any
    ): Promise<{ text: string, content: any[], usage: any, stopReason?: string }> {
        const finalModelId = validateModel(modelId);

        // Normalize Messages
        const formattedMessages = normalizeMessages(messages.filter(msg => msg.role !== 'system'));

        // Prepare System Prompt (with optional prompt caching)
        const systemMsg = messages.find(msg => msg.role === 'system');
        let system: any[] | undefined;
        if (systemMsg) {
            if (Array.isArray(systemMsg.content)) {
                system = systemMsg.content.map((block: any) => (
                    typeof block === 'string' ? { text: block } : block
                ));
            } else if (typeof systemMsg.content === 'string') {
                system = [{ text: systemMsg.content }];
            }
        }

        // Inject cachePoint at the end of the system prompt for supported models.
        // This tells Bedrock to cache the persona + rules prefix across agent loop steps,
        // reducing input token cost by ~90% on cache hits.
        if (system && system.length > 0 && ENABLE_PROMPT_CACHE && CACHE_SUPPORTED_MODELS.includes(finalModelId)) {
            system.push({ cachePoint: { type: 'default' } });
        }

        // Guardrails
        let finalGuardrailConfig = guardrailConfig;
        if (!finalGuardrailConfig && GUARDRAIL_ID) {
            finalGuardrailConfig = {
                guardrailIdentifier: GUARDRAIL_ID,
                guardrailVersion: GUARDRAIL_VERSION
            };
        }

        const input: any = {
            modelId: finalModelId,
            messages: formattedMessages,
            system,
            inferenceConfig: { maxTokens: 4096, temperature: temperature },
            stream: true
        };
        if (toolConfig) input.toolConfig = toolConfig;
        if (finalGuardrailConfig) input.guardrailConfig = finalGuardrailConfig;

        try {
            const command = new ConverseStreamCommand(input);
            const response = await bedrockClient.send(command);

            let fullText = '';
            let contentBlocks: any[] = [];
            let tokenUsage = { input: 0, output: 0, total: 0 };
            let stopReason: string | undefined;

            if (response.stream) {
                let currentBlockIndex = 0;
                for await (const chunk of response.stream) {
                    if (chunk.contentBlockStart) {
                        const start = chunk.contentBlockStart;
                        currentBlockIndex = start.contentBlockIndex || 0;
                        if (start.start?.toolUse) {
                            // Ensure block exists
                            contentBlocks[currentBlockIndex] = {
                                type: 'tool_use',
                                toolUseId: start.start.toolUse.toolUseId,
                                name: start.start.toolUse.name,
                                input: ''
                            };
                        }
                    }

                    if (chunk.contentBlockDelta) {
                        const delta = chunk.contentBlockDelta.delta;
                        if (delta?.text) {
                            const text = delta.text;
                            fullText += text;

                            // Ensure block exists
                            if (!contentBlocks[currentBlockIndex]) contentBlocks[currentBlockIndex] = { type: 'text', text: '' };
                            if (contentBlocks[currentBlockIndex].type === 'text') {
                                contentBlocks[currentBlockIndex].text += text;
                            }
                            onDelta(text);
                        }
                        if (delta?.toolUse) {
                            if (contentBlocks[currentBlockIndex] && contentBlocks[currentBlockIndex].type === 'tool_use') {
                                contentBlocks[currentBlockIndex].input += delta.toolUse.input;
                            }
                        }
                    }

                    if (chunk.messageStop) {
                        stopReason = chunk.messageStop.stopReason;
                    }

                    if (chunk.metadata) {
                        const usage = chunk.metadata.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
                        tokenUsage = { input: usage.inputTokens || 0, output: usage.outputTokens || 0, total: usage.totalTokens || 0 };
                    }
                }
            }

            // Post-process tool inputs (parse JSON)
            contentBlocks.forEach(block => {
                if (block.type === 'tool_use' && typeof block.input === 'string') {
                    try {
                        block.input = JSON.parse(block.input);
                    } catch (e) {
                        LoggerService.warn('bedrock_stream_tool_input_parse_error', { input: block.input });
                    }
                }
            });

            return { text: fullText, content: contentBlocks, usage: tokenUsage, stopReason };

        } catch (error: any) {
            LoggerService.error('bedrock_stream_callback_error', { error: error.message });
            throw error;
        }
    }
}


