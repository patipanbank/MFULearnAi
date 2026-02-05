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
            if (!res.headersSent) res.status(500).json({ error: 'Upstream Model Error' });
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
}
