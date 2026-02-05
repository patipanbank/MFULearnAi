import { AgentTool, AgentContext, ToolResult } from './AgentTool';
import { KnowledgeService } from '../services/KnowledgeService';

export class SearchTool extends AgentTool {
    name = 'search';
    description = 'Search the knowledge base for information about the system, documents, or general facts.';
    allowedRoles = ['*'];

    schema = `
<tool_definition>
    <name>search</name>
    <description>Search internal documents and knowledge base.</description>
    <parameters>
        <parameter>
            <name>query</name>
            <type>string</type>
            <description>The search query.</description>
        </parameter>
    </parameters>
</tool_definition>
`;

    async execute(args: any, context: AgentContext): Promise<ToolResult> {
        try {
            const { query } = args;
            const userContext = {
                userId: context.userId,
                role: context.role || 'student',
                department: context.department || 'General'
            };

            const result = await KnowledgeService.search(query, userContext, context.collectionId);
            if (!result) {
                return { success: true, result: "No relevant information found in the knowledge base." };
            }

            return { success: true, result };
        } catch (error: any) {
            return { success: false, result: null, error: error.message };
        }
    }
}
