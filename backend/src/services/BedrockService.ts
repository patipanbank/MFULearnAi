import { Response } from 'express';
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

    static async streamChat(
        messages: ChatMessage[],
        modelId: string,
        res: Response,
        onComplete: (fullText: string, usage: any) => void
    ) {
        const finalModelId = validateModel(modelId);

        // Prepare System Prompt
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

        // Guardrails
        let guardrailConfig: any = undefined;
        if (GUARDRAIL_ID) {
            guardrailConfig = {
                guardrailIdentifier: GUARDRAIL_ID,
                guardrailVersion: GUARDRAIL_VERSION
            };
        }

        // Normalize Messages
        const formattedMessages = normalizeMessages(messages.filter(msg => msg.role !== 'system'));

        // Prompt Caching
        const enableCaching = ENABLE_PROMPT_CACHE && CACHE_SUPPORTED_MODELS.some(m => finalModelId.includes(m));
        let additionalModelRequestFields: any = undefined;
        if (enableCaching && system && system.length > 0) {
            additionalModelRequestFields = {
                anthropic_beta: ['prompt-caching-2024-07-31']
            };
            // Add cachePoint to last system block
            const lastBlock = system[system.length - 1];
            if (!lastBlock.cachePoint) {
                // Clone to avoid mutating original if reused? 
                // Simple object spread for now
                system[system.length - 1] = { ...lastBlock, cachePoint: { type: 'default' } };
            }
        }

        try {
            const streamCommandInput: any = {
                modelId: finalModelId,
                messages: formattedMessages,
                system,
                inferenceConfig: { maxTokens: 4096, temperature: 0.5 }
            };
            if (guardrailConfig) streamCommandInput.guardrailConfig = guardrailConfig;
            if (additionalModelRequestFields) streamCommandInput.additionalModelRequestFields = additionalModelRequestFields;

            const command = new ConverseStreamCommand(streamCommandInput);
            const response = await bedrockClient.send(command);

            let fullText = '';
            let tokenUsage = { input: 0, output: 0, total: 0 };
            let currentBlockIndex = 0;

            if (response.stream) {
                for await (const chunk of response.stream) {
                    // Map AWS SDK events to Frontend SSE format

                    // 1. Content Block Start
                    if (chunk.contentBlockStart) {
                        const start = chunk.contentBlockStart;
                        currentBlockIndex = start.contentBlockIndex || 0;
                        if (start.start?.toolUse) {
                            res.write(`data: ${JSON.stringify({
                                type: 'content_block_start',
                                index: currentBlockIndex,
                                toolUse: start.start.toolUse
                            })}\n\n`);
                        }
                    }

                    // 2. Content Block Delta
                    if (chunk.contentBlockDelta) {
                        const delta = chunk.contentBlockDelta.delta;
                        if (delta?.text) {
                            fullText += delta.text;
                            res.write(`data: ${JSON.stringify({
                                type: 'text_delta',
                                text: delta.text,
                                index: currentBlockIndex
                            })}\n\n`);
                        }
                        if (delta?.toolUse) {
                            res.write(`data: ${JSON.stringify({
                                type: 'input_delta',
                                input: delta.toolUse.input,
                                index: currentBlockIndex
                            })}\n\n`);
                        }
                    }

                    // 3. Message Stop
                    if (chunk.messageStop) {
                        const stopReason = chunk.messageStop.stopReason;
                        res.write(`data: ${JSON.stringify({ type: 'message_stop', stopReason })}\n\n`);
                    }

                    // 4. Metadata (Usage)
                    if (chunk.metadata) {
                        const usage = chunk.metadata.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
                        const cacheUsage = (chunk.metadata as any).cacheUsage || null;

                        tokenUsage = { input: usage.inputTokens || 0, output: usage.outputTokens || 0, total: usage.totalTokens || 0 };

                        const usagePayload: any = {
                            type: 'usage',
                            usage: tokenUsage
                        };
                        if (cacheUsage) usagePayload.cacheUsage = cacheUsage;
                        res.write(`data: ${JSON.stringify(usagePayload)}\n\n`);
                    }
                }
            }

            res.write('data: [DONE]\n\n');
            res.end();
            onComplete(fullText, tokenUsage);

        } catch (error: any) {
            LoggerService.error('bedrock_stream_internal_error', { error: error.message });
            if (!res.headersSent) {
                res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
                res.end();
            }
        }
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
     * Stream chat response token-by-token via SSE.
     * Used for the FINAL ANSWER step in the agent loop (non-tool-use).
     */
    static async streamChatSSE(
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

        // Prepare System Prompt
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
                        LoggerService.warn('bedrock_stream_sse_parse_error', { input: block.input });
                    }
                }
            });

            return { text: fullText, content: contentBlocks, usage: tokenUsage, stopReason };

        } catch (error: any) {
            LoggerService.error('bedrock_stream_sse_error', { error: error.message });
            throw error;
        }
    }
}


