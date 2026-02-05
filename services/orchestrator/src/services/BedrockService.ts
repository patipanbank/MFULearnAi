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

            response.data.on('data', (chunk: Buffer) => {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') continue;
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.text) fullResponseText += data.text;
                            if (data.type === 'usage' && data.usage) tokenUsage = data.usage;
                        } catch (e) { }
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
        temperature: number = 0.5
    ): Promise<string> {
        try {
            const response = await axios({
                method: 'post',
                url: `${BEDROCK_TEXT_URL}/chat`,
                data: {
                    messages,
                    modelId,
                    system,      // Pass system prompt if supported by downstream
                    temperature,  // Pass params
                    stream: false // Hint downstream to not stream (if supported)
                },
                headers: {
                    'Authorization': `Bearer ${TokenService.mint('bedrock', 'write')}`,
                    'x-correlation-id': ContextService.getCorrelationId()
                },
                responseType: 'json', // Expect JSON if stream=false supported
                timeout: 60000
            });

            // If downstream supports stream: false, it returns { text: "..." }
            if (response.data && response.data.text) {
                return response.data.text;
            }

            // Fallback: If it returns stream despite request? (Unlikely with axios json default)
            // But let's assume it might return ndjson if it ignores stream: false
            return JSON.stringify(response.data);

        } catch (error: any) {
            // If we failed because it forced stream, we'd need to handle stream consumption.
            // For now assume bedrock-text supports non-streaming if requested or simple JSON.
            // If bedrock-text ONLY streams, we must consume stream here.
            // Let's implement stream consumption fallback if needed, but for MVP let's assume JSON.
            console.error('[BedrockService] SendChat Error:', error.message);
            throw error;
        }
    }
}
