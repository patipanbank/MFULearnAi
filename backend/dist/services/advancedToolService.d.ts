import { Tool } from "langchain/tools";
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
    getTool(name: string): Tool | undefined;
    getAllTools(): Tool[];
    getToolNames(): string[];
    private validatePath;
}
export declare const advancedToolService: AdvancedToolService;
//# sourceMappingURL=advancedToolService.d.ts.map