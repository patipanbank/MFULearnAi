import { BedrockService } from '../BedrockService';
import { WorkflowStep } from './types';
import { LoggerService } from '../LoggerService';

// Simple Schema Definition (Replacement for Zod)
interface FieldSchema {
    type: 'string' | 'number' | 'boolean' | 'array';
    description: string;
    optional?: boolean;
}

interface ToolSchema {
    [key: string]: FieldSchema;
}

export class ParameterExtractor {

    // R3.2: Tool Arguments must come from Compiler (Schema Registry)
    private static SCHEMAS: Record<string, ToolSchema> = {
        'calculator': {
            expression: { type: 'string', description: 'Mathematical expression to evaluate, e.g. "500 * 0.15"' }
        },
        'search': {
            query: { type: 'string', description: 'Search query optimized for keyword search' }
        },
        'grade_service': {
            studentId: { type: 'string', description: 'Student ID' },
            term: { type: 'string', description: 'Term/Semester', optional: true }
        }
    };

    static async extract(
        userId: string,
        query: string,
        step: WorkflowStep,
        context: any
    ): Promise<Record<string, any>> {

        const schema = this.SCHEMAS[step.tool];
        if (!schema) {
            LoggerService.warn('Missing schema for tool', { tool: step.tool });
            return {};
        }

        const prompt = `
        You are a Parameter Extractor.
        Goal: Extract parameters for the tool "${step.tool}" based on the user query.
        
        Schema Definition:
        ${JSON.stringify(schema, null, 2)}

        Context:
        User Query: "${query}"
        Current User ID: "${userId}"

        Instructions:
        - Output strict JSON only.
        - If a parameter is missing and optional, omit it.
        - If a parameter is missing and required, try to find it in Context.
        - If absolutely missing, return null for that field.
        `;

        try {
            // Use Haiku for speed
            const { text: response } = await BedrockService.sendChat(
                'anthropic.claude-3-haiku-20240307-v1:0',
                [{ role: 'user', content: prompt }],
                'Output strict JSON within <json></json> tags.',
                0.1
            );

            // 2. Parse
            const jsonMatch = response.match(/<json>([\s\S]*?)<\/json>/);
            const rawJson = jsonMatch ? jsonMatch[1] : response;
            const parsed = JSON.parse(rawJson);

            // 3. Simple Validation (R3.2)
            const validation = this.validate(parsed, schema);

            if (validation.valid) {
                return parsed;
            } else {
                LoggerService.warn('Parameter Validation Failed', { errors: validation.errors, tool: step.tool });
                return parsed; // Return what we have, orchestrated tool might fail later
            }

        } catch (error: any) {
            LoggerService.error('Parameter Extraction Failed', { error: error.message });
            return {};
        }
    }

    private static validate(data: any, schema: ToolSchema): { valid: boolean, errors: string[] } {
        const errors: string[] = [];
        for (const key in schema) {
            const field = schema[key];
            const value = data[key];

            if (value === undefined || value === null) {
                if (!field.optional) {
                    errors.push(`Missing required field: ${key}`);
                }
                continue;
            }

            if (field.type === 'string' && typeof value !== 'string') errors.push(`Field ${key} must be string`);
            if (field.type === 'number' && typeof value !== 'number') errors.push(`Field ${key} must be number`);
            if (field.type === 'boolean' && typeof value !== 'boolean') errors.push(`Field ${key} must be boolean`);
            if (field.type === 'array' && !Array.isArray(value)) errors.push(`Field ${key} must be array`);
        }
        return { valid: errors.length === 0, errors };
    }
}
