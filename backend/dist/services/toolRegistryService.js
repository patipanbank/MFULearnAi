"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolRegistryService = exports.ToolRegistryService = void 0;
class ToolRegistryService {
    constructor() {
        this.tools = new Map();
        this.initializeDefaultTools();
    }
    initializeDefaultTools() {
        this.registerTool({
            name: 'web_search',
            description: 'Search the web for current information',
            execute: async (query) => {
                return `Search results for: ${query}\n\nThis is a placeholder for web search functionality.`;
            }
        });
        this.registerTool({
            name: 'calculator',
            description: 'Perform mathematical calculations',
            execute: async (expression) => {
                try {
                    const result = eval(expression);
                    return `Calculation result: ${expression} = ${result}`;
                }
                catch (error) {
                    return `Error calculating ${expression}: ${error}`;
                }
            }
        });
        this.registerTool({
            name: 'get_current_date',
            description: 'Get the current date and time',
            execute: async () => {
                const now = new Date();
                return `Current date and time: ${now.toLocaleString()}`;
            }
        });
        console.log('✅ Tool registry initialized with default tools');
    }
    registerTool(tool) {
        this.tools.set(tool.name, tool);
    }
    getTool(name) {
        return this.tools.get(name);
    }
    getToolsForSession(sessionId) {
        return Array.from(this.tools.values());
    }
    async executeTool(toolName, input) {
        const tool = this.getTool(toolName);
        if (!tool) {
            throw new Error(`Tool ${toolName} not found`);
        }
        try {
            return await tool.execute(input);
        }
        catch (error) {
            throw new Error(`Error executing tool ${toolName}: ${error}`);
        }
    }
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }
    getToolDescriptions() {
        const descriptions = {};
        for (const [name, tool] of this.tools) {
            descriptions[name] = tool.description;
        }
        return descriptions;
    }
}
exports.ToolRegistryService = ToolRegistryService;
exports.toolRegistryService = new ToolRegistryService();
//# sourceMappingURL=toolRegistryService.js.map