export interface ToolResult {
    success: boolean;
    result: any;
    error?: string;
}

export interface AgentContext {
    userId: string;
    role: string;
    department?: string;
    collectionId?: string;
}

export abstract class AgentTool {
    abstract name: string;
    abstract description: string;
    abstract allowedRoles: string[];

    // Define schema for prompt generation
    abstract schema: string;

    abstract execute(args: any, context: AgentContext): Promise<ToolResult>;

    isAllowed(role: string): boolean {
        return this.allowedRoles.includes(role) || this.allowedRoles.includes('*');
    }
}
