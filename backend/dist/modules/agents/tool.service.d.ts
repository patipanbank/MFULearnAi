import { ChromaService } from '../../services/chroma.service';
import { BedrockService } from '../../infrastructure/bedrock/bedrock.service';
export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
    metadata?: Record<string, any>;
}
export interface Tool {
    name: string;
    description: string;
    inputSchema: Record<string, any>;
    execute: (params: any) => Promise<ToolResult>;
}
export declare class ToolService {
    private readonly chromaService;
    private readonly bedrockService;
    private readonly logger;
    private readonly tools;
    constructor(chromaService: ChromaService, bedrockService: BedrockService);
    private initializeTools;
    registerTool(tool: Tool): void;
    getTool(name: string): Tool | undefined;
    getAllTools(): Tool[];
    getToolNames(): string[];
    executeTool(name: string, params: any): Promise<ToolResult>;
    private calculateExpression;
    private evaluateMathExpression;
    private searchWeb;
    private searchDocuments;
    private summarizeText;
    private getCurrentTime;
}
