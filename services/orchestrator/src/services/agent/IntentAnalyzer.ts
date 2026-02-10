import { BedrockService } from '../BedrockService';
import { Intent, IntentAnalysisResult } from './types';
import { LoggerService } from '../LoggerService';

export class IntentAnalyzer {

    static async analyze(
        userId: string,
        query: string,
        history: any[]
    ): Promise<IntentAnalysisResult> {

        // 1. Guard Clauses (Rule: Regex First)
        if (/^(hi|hello|hey|good morning)/i.test(query)) {
            return this.createResult(Intent.CHITCHAT, 1.0);
        }
        if (/^(calculate|compute|math|what is \d)/i.test(query)) {
            return this.createResult(Intent.CALCULATION, 0.9);
        }

        // 2. LLM Classification (Haiku)
        const prompt = `
        Classify the intent of the following user query into one of these categories:
        ${Object.values(Intent).join(', ')}

        History:
        ${history.slice(-2).map(m => `${m.role}: ${m.content}`).join('\n')}

        User Query: "${query}"

        Instructions:
        - Return strictly JSON.
        - Confidence must be 0.0 to 1.0.
        - Extract fundamental entities if present (e.g. topic, numbers).
        `;

        try {
            const { text: response } = await BedrockService.sendChat(
                'anthropic.claude-3-haiku-20240307-v1:0',
                [{ role: 'user', content: prompt }],
                'Output strict JSON within <json></json> tags.',
                0.1
            );

            const jsonMatch = response.match(/<json>([\s\S]*?)<\/json>/);
            const rawJson = jsonMatch ? jsonMatch[1] : response;
            const parsed = JSON.parse(rawJson);

            // Validation: Ensure valid Enum
            let intent = parsed.intent;
            if (!Object.values(Intent).includes(intent)) {
                LoggerService.warn('Invalid Intent detected, falling back', { intent });
                intent = Intent.GENERAL_QUERY;
            }

            return {
                intent: intent as Intent,
                confidence: parsed.confidence || 0.5,
                entities_raw: parsed.entities || {},
                constraints_validated: {}, // In future, validate strict constraints
                reasoning: parsed.reasoning
            };

        } catch (error: any) {
            LoggerService.error('Intent Analysis Failed', { error: error.message });
            return this.createResult(Intent.GENERAL_QUERY, 0.0);
        }
    }

    private static createResult(intent: Intent, confidence: number): IntentAnalysisResult {
        return {
            intent,
            confidence,
            entities_raw: {},
            constraints_validated: {}
        };
    }
}
export { IntentAnalysisResult };

