import axios from 'axios';
import { ChatMessage } from '../../../../shared/types';
import { Response } from 'express';
import { TokenService } from './TokenService';
import { ContextService } from './ContextService';

const BEDROCK_TEXT_URL = process.env.BEDROCK_TEXT_URL || 'http://localhost:5001/api/bedrock';

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
                // Keep the last partial line in the buffer
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
                                console.log(`[BedrockService] Stream Usage Received:`, tokenUsage);
                            }
                        } catch (e) {
                            // Only log if it's not a partial JSON at the end (which shouldn't happen with the split logic unless data: prefix is split)
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
                console.error('[BedrockService] Stream error:', err);
                if (!res.headersSent) res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
                res.end();
            });

        } catch (error: any) {
            console.error('[BedrockService] Request Error:', error.message);
            if (!res.headersSent && typeof res.status === 'function') {
                res.status(500).json({ error: 'Upstream Model Error' });
            } else if (!res.headersSent) {
                // Background/Mock response handling
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
        system?: string,
        temperature: number = 0.5,
        toolConfig?: any
    ): Promise<{ text: string, usage: any, stopReason?: string }> {
        try {
            const requestData: any = {
                messages,
                modelId,
                system,      // Pass system prompt if supported by downstream
                temperature,  // Pass params
                stream: false // Hint downstream to not stream (if supported)
            };

            if (toolConfig) {
                requestData.toolConfig = toolConfig;
            }

            const response = await axios({
                method: 'post',
                url: `${BEDROCK_TEXT_URL}/chat`,
                data: requestData,
                headers: {
                    'Authorization': `Bearer ${TokenService.mint('bedrock', 'write')}`,
                    'x-correlation-id': ContextService.getCorrelationId()
                },
                responseType: 'json', // Expect JSON if stream=false supported
                timeout: 60000
            });

            // Robust content extraction
            let content = '';
            let stopReason = response.data.stopReason;

            // Handle Tool Use Response (Claude 3.5 Native)
            if (stopReason === 'tool_use' || (response.data.content && Array.isArray(response.data.content))) {
                // Return the raw content array if it contains tool_use
                // downstream AgentWorkflow will parse it
                if (Array.isArray(response.data.content)) {
                    // For now, we serialize the content array to string if it's mixed text+tool, 
                    // BUT AgentWorkflow needs to know. 
                    // Let's return the raw content object if possible or stringify it carefully.
                    // Actually, let's keep the existing signature returning string, but if tool_use, return JSON string of content
                    content = JSON.stringify(response.data.content);
                }
            } else if (response.data && response.data.content !== undefined) {
                content = typeof response.data.content === 'string' ? response.data.content : JSON.stringify(response.data.content);
            } else if (response.data && response.data.text !== undefined) {
                content = response.data.text;
            }

            if (!content && response.data.success === false) {
                console.error('[BedrockService] Model Error Response:', response.data.error || 'Unknown error');
                throw new Error(response.data.error || 'Upstream Model Error');
            }

            const usage = response.data.usage || { input: 0, output: 0, total: 0 };

            if (!content) {
                console.warn('[BedrockService] Warning: Received empty content from model', {
                    status: response.status,
                    stopReason: response.data.stopReason,
                    dataKeys: response.data ? Object.keys(response.data) : [],
                    usage
                });
            }

            console.log(`[BedrockService] SendChat Usage Received:`, usage, `StopReason:`, stopReason);

            return { text: content, usage, stopReason };
        } catch (error: any) {
            // R7: Model Fallback Mechanism
            const isAccessError = error.response?.data?.error?.includes('Access to this model is not available') ||
                error.message?.includes('AccessDeniedException') ||
                error.response?.status === 403;

            if (isAccessError && modelId.includes('haiku')) {
                console.warn(`[BedrockService] Model ${modelId} not available. Falling back to Sonnet.`);
                // Recursive call with Sonnet
                // Note: Sonnet might be slower/more expensive, but it works.
                // Try standard Sonnet 3 or 3.5 if available
                const fallbackModel = 'anthropic.claude-3-sonnet-20240229-v1:0';
                if (modelId !== fallbackModel) {
                    return this.sendChat(fallbackModel, messages, system, temperature, toolConfig);
                }
            }

            console.error('[BedrockService] SendChat Error:', error.message, {
                responseData: error.response?.data
            });
            throw error;
        }
    }
}
