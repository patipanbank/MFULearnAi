import { DynamicTool } from "@langchain/core/tools";
export interface AdvancedToolConfig {
    weatherApiKey?: string;
    translateApiKey?: string;
    newsApiKey?: string;
}
export declare class AdvancedToolService {
    private tools;
    private config;
    constructor(config?: AdvancedToolConfig);
    private initializeTools;
    getTool(name: string): DynamicTool | undefined;
    getAllTools(): DynamicTool[];
    getToolNames(): string[];
    private validatePath;
}
export declare const advancedToolService: AdvancedToolService;
//# sourceMappingURL=advancedToolService.d.ts.map