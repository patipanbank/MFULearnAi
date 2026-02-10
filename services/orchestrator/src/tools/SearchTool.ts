import { AgentTool, AgentContext, ToolResult } from './AgentTool';
import { KnowledgeService } from '../services/KnowledgeService';

export class SearchTool extends AgentTool {
    name = 'search';
    description = 'Search the knowledge base for information about the system, documents, or general facts.';
    allowedRoles = ['*'];

    // Native JSON Schema for Bedrock/Claude 3.5
    schemaJSON = {
        name: 'search',
        description: 'Search internal documents and knowledge base.',
        inputSchema: {
            json: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The search query.'
                    }
                },
                required: ['query']
            }
        }
    };

    async execute(args: any, context: AgentContext): Promise<ToolResult> {
        try {
            const { query } = args;
            if (!query || typeof query !== 'string' || query.trim().length === 0) {
                return { success: false, result: null, error: 'Search query is missing or empty.' };
            }
            const userContext = {
                userId: context.userId,
                role: context.role || 'student',
                department: context.department || 'General'
            };

            const { text, blocks } = await KnowledgeService.search(query, userContext, context.collectionId);
            if (!text && (!blocks || blocks.length === 0)) {
                return { success: true, result: "No relevant information found in the knowledge base." };
            }

            // R2: Return structured blocks so the AgentWorkflow can parse IDs and valid citations
            // However, for pure Text Synthesis, we return the 'text' which is already formatted with <block> tags.
            return { success: true, result: text };
        } catch (error: any) {
            return { success: false, result: null, error: error.message };
        }
    }
}
