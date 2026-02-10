import axios from 'axios';
import { ChatMessage } from '../../../../shared/types';
import { Response } from 'express';
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
    static async streamChat(
        messages: ChatMessage[],
        modelId: string,
        res: Response,
        onComplete: (fullText: string, usage: any) => void
    ) {
        try {
            const response = await axios({
                method: 'post',
                url: `${BEDROCK_TEXT_URL}/chat`,
                data: { messages, modelId },
                headers: {
                    'Authorization': `Bearer ${TokenService.mint('bedrock', 'write')}`,
                    'x-correlation-id': ContextService.getCorrelationId()
                },
                responseType: 'stream',
                timeout: 120000
            });

            let fullResponseText = '';
            let tokenUsage = { input: 0, output: 0, total: 0 };

            let buffer = '';
            response.data.on('data', (chunk: Buffer) => {
                buffer += chunk.toString();
                let params = buffer.split('\n');
                buffer = params.pop() || '';

                for (const line of params) {
                    if (line.trim().startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') continue;
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.text) fullResponseText += data.text;
                            if (data.type === 'usage' && data.usage) {
                                tokenUsage = data.usage;
                            }
                        } catch (e) {
                            // Partial JSON — skip
                        }
                    }
                }
                res.write(chunk);
            });

            response.data.on('end', () => {
                res.end();
                onComplete(fullResponseText, tokenUsage);
            });

            response.data.on('error', (err: Error) => {
                LoggerService.error('bedrock_stream_error', { error: err.message });
                if (!res.headersSent) res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
                res.end();
            });

        } catch (error: any) {
            LoggerService.error('bedrock_stream_request_error', { error: error.message });
            if (!res.headersSent && typeof res.status === 'function') {
                res.status(500).json({ error: 'Upstream Model Error' });
            } else if (!res.headersSent) {
                res.write(`data: ${JSON.stringify({ error: 'Upstream Model Error', message: error.message })}\n\n`);
                res.end();
            }
        }
    }

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
                LoggerService.info('bedrock_sendchat', { modelId, attempt, hasTools: !!toolConfig });

                const response = await axios({
                    method: 'post',
                    url: `${BEDROCK_TEXT_URL}/chat`,
                    data: requestData,
                    headers: {
                        'Authorization': `Bearer ${TokenService.mint('bedrock', 'write')}`,
                        'x-correlation-id': ContextService.getCorrelationId()
                    },
                    responseType: 'json',
                    timeout: 60000
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
}

