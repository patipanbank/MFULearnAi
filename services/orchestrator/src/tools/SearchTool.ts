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
            const userContext = {
                userId: context.userId,
                role: context.role || 'student',
                department: context.department || 'General'
            };

            const { text } = await KnowledgeService.search(query, userContext, context.collectionId);
            if (!text) {
                return { success: true, result: "No relevant information found in the knowledge base." };
            }

            return { success: true, result: text };
        } catch (error: any) {
            return { success: false, result: null, error: error.message };
        }
    }
}
