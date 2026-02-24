import axios from 'axios';
import { ChatMessage } from '../../../../shared/types';
import { TokenService } from './TokenService';
import { ContextService } from './ContextService';
import { LoggerService } from './LoggerService';

const BEDROCK_TEXT_URL = process.env.BEDROCK_TEXT_URL || 'http://localhost:5001/api/bedrock';

/** Retry configuration for transient errors */
const RETRY_CONFIG = {
    maxRetries: 2,
    baseDelayMs: 1000,
    retryableStatuses: [429, 503, 502],
};

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class BedrockService {

    static async getModels() {
        const response = await axios.get(`${BEDROCK_TEXT_URL}/models`, {
            headers: {
                'Authorization': `Bearer ${TokenService.mint('bedrock', 'read')}`,
                'x-correlation-id': ContextService.getCorrelationId()
            }
        });
        return response.data;
    }

    static async sendChat(
        modelId: string,
        messages: ChatMessage[],
        system?: string | Array<{ text: string }>,
        temperature: number = 0.5,
        toolConfig?: any,
        guardrailConfig?: any
    ): Promise<{ text: string, usage: any, stopReason?: string, cacheUsage?: any, guardrailTrace?: any }> {
        const requestData: any = {
            messages,
            modelId,
            system,
            temperature,
            stream: false
        };

        if (toolConfig) requestData.toolConfig = toolConfig;
        if (guardrailConfig) requestData.guardrailConfig = guardrailConfig;

        // Retry loop with exponential backoff
        for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
            try {
                // Diagnostic: count doc blocks in messages for logging
                const docBlockCount = messages.reduce((sum: number, m: any) => {
                    if (Array.isArray(m.content)) {
                        return sum + m.content.filter((b: any) => b.type === 'document').length;
                    }
                    return sum;
                }, 0);

                LoggerService.info('bedrock_sendchat', { modelId, attempt, hasTools: !!toolConfig, docBlocks: docBlockCount });

                const response = await axios({
                    method: 'post',
                    url: `${BEDROCK_TEXT_URL}/chat`,
                    data: requestData,
                    headers: {
                        'Authorization': `Bearer ${TokenService.mint('bedrock', 'write')}`,
                        'x-correlation-id': ContextService.getCorrelationId()
                    },
                    responseType: 'json',
                    timeout: 120000,            // Increase timeout for large file payloads
                    maxBodyLength: Infinity,     // Prevent silent truncation of large base64 payloads
                    maxContentLength: Infinity
                });

                // Robust content extraction
                let content = '';
                let stopReason = response.data.stopReason;

                if (stopReason === 'tool_use' || (response.data.content && Array.isArray(response.data.content))) {
                    if (Array.isArray(response.data.content)) {
                        content = JSON.stringify(response.data.content);
                    }
                } else if (response.data && response.data.content !== undefined) {
                    content = typeof response.data.content === 'string' ? response.data.content : JSON.stringify(response.data.content);
                } else if (response.data && response.data.text !== undefined) {
                    content = response.data.text;
                }

                if (!content && response.data.success === false) {
                    throw new Error(response.data.error || 'Upstream Model Error');
                }

                const usage = response.data.usage || { input: 0, output: 0, total: 0 };

                if (!content) {
                    LoggerService.warn('bedrock_empty_content', {
                        status: response.status,
                        stopReason,
                        dataKeys: response.data ? Object.keys(response.data) : []
                    });
                }

                const cacheUsage = response.data.cacheUsage || null;
                const guardrailTrace = response.data.guardrailTrace || null;

                return { text: content, usage, stopReason, cacheUsage, guardrailTrace };

            } catch (error: any) {
                const status = error.response?.status;
                const isRetryable = RETRY_CONFIG.retryableStatuses.includes(status);
                const canRetry = attempt < RETRY_CONFIG.maxRetries && isRetryable;

                LoggerService.warn('bedrock_sendchat_error', {
                    error: error.message,
                    status,
                    attempt,
                    willRetry: canRetry
                });

                if (canRetry) {
                    const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
                    LoggerService.info('bedrock_retry', { attempt: attempt + 1, delayMs: delay });
                    await sleep(delay);
                    continue;
                }

                throw error;
            }
        }

        // Should never reach here, but TypeScript needs it
        throw new Error('Bedrock sendChat: max retries exceeded');
    }

    /**
     * Stream chat response token-by-token via SSE.
     * Used for the FINAL ANSWER step in the agent loop (non-tool-use).
     * Calls bedrock-text with stream:true and parses SSE chunks.
     *
     * @param modelId - Bedrock model ID
     * @param messages - Conversation messages
     * @param onDelta - Callback invoked per text delta chunk
     * @param temperature - Model temperature (default 0.5)
     * @param toolConfig - Optional tool configuration (typically undefined for final answer)
     * @param guardrailConfig - Optional guardrail configuration
     * @returns Accumulated full text + usage stats
     */
    static async streamWithCallback(
        modelId: string,
        messages: ChatMessage[],
        onDelta: (delta: string) => void,
        temperature: number = 0.5,
        toolConfig?: any,
        guardrailConfig?: any
    ): Promise<{ text: string, content: any[], usage: any, stopReason?: string }> {
        const requestData: any = {
            messages,
            modelId,
            temperature,
            stream: true // Force streaming mode
        };

        if (toolConfig) requestData.toolConfig = toolConfig;
        if (guardrailConfig) requestData.guardrailConfig = guardrailConfig;

        try {
            const response = await axios({
                method: 'post',
                url: `${BEDROCK_TEXT_URL}/chat`,
                data: requestData,
                headers: {
                    'Authorization': `Bearer ${TokenService.mint('bedrock', 'write')}`,
                    'x-correlation-id': ContextService.getCorrelationId()
                },
                responseType: 'stream',
                timeout: 120000,
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });

            // Accumulators
            let fullText = '';
            let contentBlocks: any[] = []; // Store structured blocks (text or tool_use)
            let tokenUsage = { input: 0, output: 0, total: 0 };
            let stopReason: string | undefined;
            let buffer = '';

            return new Promise((resolve, reject) => {
                response.data.on('data', (chunk: Buffer) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith('data:')) continue;

                        const dataStr = trimmed.replace(/^data:\s*/, '');
                        if (dataStr === '[DONE]') continue;

                        try {
                            const data = JSON.parse(dataStr);

                            // 1. Text Delta (Standard text streaming)
                            if (data.type === 'text_delta' || data.text) {
                                const text = data.text || '';
                                fullText += text;

                                // Ensure content block exists for text
                                const idx = data.index || 0;
                                if (!contentBlocks[idx]) contentBlocks[idx] = { type: 'text', text: '' };
                                if (contentBlocks[idx].type === 'text') {
                                    contentBlocks[idx].text += text;
                                }

                                onDelta(text);
                            }

                            // 2. Tool Use Start
                            if (data.type === 'content_block_start' && data.toolUse) {
                                const idx = data.index || 0;
                                contentBlocks[idx] = {
                                    type: 'tool_use',
                                    toolUseId: data.toolUse.toolUseId,
                                    name: data.toolUse.name,
                                    input: '' // Will be built via input_delta
                                };
                            }

                            // 3. Tool Input Delta
                            if (data.type === 'input_delta' && data.input) {
                                const idx = data.index || 0;
                                if (contentBlocks[idx] && contentBlocks[idx].type === 'tool_use') {
                                    contentBlocks[idx].input += data.input;
                                }
                            }

                            // 4. Stop Reason
                            if (data.type === 'message_stop' || data.stopReason) {
                                stopReason = data.stopReason || stopReason;
                            }

                            // 5. Usage
                            if (data.type === 'usage' && data.usage) {
                                tokenUsage = data.usage;
                            }

                        } catch (e) {
                            // Partial JSON — safe to skip
                        }
                    }
                });

                response.data.on('end', () => {
                    // Post-process tool inputs (parse JSON)
                    contentBlocks.forEach(block => {
                        if (block.type === 'tool_use' && typeof block.input === 'string') {
                            try {
                                block.input = JSON.parse(block.input);
                            } catch (e) {
                                console.warn('[BedrockService] Failed to parse tool input JSON', block.input);
                            }
                        }
                    });

                    resolve({ text: fullText, content: contentBlocks, usage: tokenUsage, stopReason });
                });

                response.data.on('error', (err: Error) => {
                    LoggerService.error('bedrock_stream_sse_error', { error: err.message });
                    reject(err);
                });
            });

        } catch (error: any) {
            LoggerService.error('bedrock_stream_sse_request_error', { error: error.message });
            throw error;
        }
    }
}

