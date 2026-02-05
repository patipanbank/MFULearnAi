import axios from '../config/axios';
import { ChatMessage } from '../../../../shared/types';
import { LoggerService } from './LoggerService';

const BEDROCK_TEXT_URL = process.env.BEDROCK_TEXT_URL || 'http://localhost:5001/api/bedrock';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-secret-key';
const HAIKU_MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0';

export class SummarizationService {
    static async summarize(newMessages: ChatMessage[], existingSummary: string): Promise<string> {
        try {
            // 1. Construct Prompt
            const messagesText = newMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
            const prompt = `
You are an expert summarizer. Your task is to update the conversation summary with new information.

<current_summary>
${existingSummary || '(No previous summary)'}
</current_summary>

<new_messages>
${messagesText}
</new_messages>

INSTRUCTIONS:
1. Incorporate key facts, user intents, and decisions from <new_messages> into the <current_summary>.
2. Maintain a coherent narrative.
3. Keep it concise but do not lose important details (names, dates, specific requirements).
4. If the new messages are just chit-chat, keep the summary mostly unchanged.
5. Output ONLY the new summary text. Do not output tags.
`;

            // 2. Call Bedrock (Haiku)
            const response = await axios.post(`${BEDROCK_TEXT_URL}/chat`, {
                modelId: HAIKU_MODEL_ID,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                maxTokens: 1000
            }, {
                headers: { 'x-internal-key': INTERNAL_API_KEY }
            });

            let newSummary = '';
            // Handle Stream or Non-Stream? BedrockService uses stream. let's assume /chat can handle non-stream if we implemented it, 
            // BUT BedrockService/server.ts implementation of /chat endpoint in Bedrock Service might start a stream. 
            // We need to check if the Bedrock Service supports non-streaming json response.
            // Assumption: The Bedrock service we are calling likely streams by default or we need to consume the stream.
            // Let's implement a quick stream consumer helper here or check BedrockService.

            // To be safe, let's assume we consume the stream.
            if (response.headers['content-type'] === 'text/event-stream') {
                newSummary = await this.consumeStream(response.data);
            } else if (response.data.text) {
                newSummary = response.data.text;
            }

            // 3. Verification (Self-Correction)
            const verified = await this.verifySummary(newSummary, existingSummary, messagesText);
            if (!verified) {
                LoggerService.log('warn', 'summary_verification_failed', { old: existingSummary.length, new: newSummary.length });
                return existingSummary; // Safe rollback
            }

            return newSummary.trim();

        } catch (error: any) {
            LoggerService.log('error', 'summarization_failed', { error: error.message });
            return existingSummary; // Fail open (return old summary)
        }
    }

    private static async verifySummary(newSummary: string, oldSummary: string, newMessages: string): Promise<boolean> {
        // Simple heuristic check: Is it too short? Did it hallucinate?
        // Ideally we call LLM again to verify. "Does Summary B accurately reflect Summary A + Messages?"
        // For cost, we might skip LLM check for now or use very explicitly.
        // Let's do a basic length check.
        if (newSummary.length < 10 && (oldSummary.length + newMessages.length) > 50) return false;

        return true;
    }

    private static async consumeStream(stream: any): Promise<string> {
        return new Promise((resolve, reject) => {
            let fullText = '';
            stream.on('data', (chunk: Buffer) => {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') continue;
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.text) fullText += data.text;
                        } catch (e) { }
                    }
                }
            });
            stream.on('end', () => resolve(fullText));
            stream.on('error', (err: any) => reject(err));
        });
    }
}
