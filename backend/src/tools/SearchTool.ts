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
                    },
                    context: {
                        type: 'string',
                        description: 'Additional context to refine the search (e.g., specific terms, policy names).'
                    }
                },
                required: ['query']
            }
        }
    };

    async execute(args: any, context: AgentContext): Promise<ToolResult> {
        try {
            const { query, context: queryContext } = args;

            // Query Expansion
            const expandedQuery = queryContext ? `${query} ${queryContext}` : query;

            const userContext = {
                userId: context.userId,
                role: context.role || 'student',
                department: context.department || 'General'
            };

            const { text, sources, blocks } = await KnowledgeService.search(expandedQuery, userContext, { collectionId: context.collectionId });

            if (!text && (!blocks || blocks.length === 0)) {
                return { success: true, result: "No relevant information found in the knowledge base." };
            }

            // Return formatted text + sources for citation
            let result = text;
            if (sources && sources.length > 0) {
                const sourceList = sources.map((s: any) => `- [${s.id}] ${s.name}`).join('\n');
                result += `\n\n=== SOURCES ===\n${sourceList}`;
            }

            return { success: true, result: result };
        } catch (error: any) {
            return { success: false, result: null, error: error.message };
        }
    }
}
