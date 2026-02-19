import { MCPClient } from './MCPClient';
import { AgentTool, ToolResult, AgentContext } from '../tools/AgentTool';

export class McpToolAdapter extends AgentTool {
    public name: string;
    public description: string;
    public allowedRoles = ['*'];

    constructor(
        private client: MCPClient,
        private toolDef: any
    ) {
        super();
        this.name = toolDef.name;
        this.description = toolDef.description;
    }

    get schemaJSON() {
        return {
            name: this.toolDef.name,
            description: this.toolDef.description,
            inputSchema: {
                json: this.toolDef.inputSchema
            }
        };
    }

    async execute(input: any, context?: AgentContext): Promise<ToolResult> {
        try {
            const rawResult = await this.client.callTool(this.toolDef.name, input);

            // Try to parse if it looks like JSON string, otherwise return as is
            let result = rawResult;
            if (typeof rawResult === 'string' && (rawResult.startsWith('{') || rawResult.startsWith('['))) {
                try {
                    result = JSON.parse(rawResult);
                } catch (e) {
                    // keep as string
                }
            }

            return {
                success: true,
                result: result
            };
        } catch (error: any) {
            return {
                success: false,
                result: null,
                error: error.message
            };
        }
    }
}
