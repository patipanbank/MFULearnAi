import { MCPClient } from './MCPClient';

export class McpToolAdapter {
    constructor(
        private client: MCPClient,
        private toolDef: any
    ) { }

    get schemaJSON() {
        return {
            name: this.toolDef.name,
            description: this.toolDef.description,
            inputSchema: {
                json: this.toolDef.inputSchema
            }
        };
    }

    // Checking permissions? For now assume all MCP tools are allowed if the server lists them.
    isAllowed(userRole: string) {
        return true;
    }

    async execute(input: any, context?: any) {
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
                error: error.message
            };
        }
    }
}
