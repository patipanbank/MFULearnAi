"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRetrievalTools = exports.createMemoryTool = exports.toolRegistry = exports.ToolRegistry = void 0;
const WebSearchTool_1 = require("./WebSearchTool");
const CalculatorTool_1 = require("./CalculatorTool");
const MemoryTool_1 = require("./MemoryTool");
const RetrievalTool_1 = require("./RetrievalTool");
class ToolRegistry {
    constructor() {
        this.staticTools = new Map();
        this.initializeStaticTools();
        console.log('✅ Tool registry initialized');
    }
    initializeStaticTools() {
        const webSearchTool = new WebSearchTool_1.WebSearchTool();
        this.staticTools.set('web_search', webSearchTool.getToolMeta());
        const calculatorTool = new CalculatorTool_1.CalculatorTool();
        this.staticTools.set('calculator', calculatorTool.getToolMeta());
        this.staticTools.set('current_date', {
            name: 'current_date',
            description: 'Get the current date and time. Use this when someone asks about the current date, time, or what day it is today.',
            func: async (_input, _sessionId, config) => {
                try {
                    const tz = config?.timezone || 'Asia/Bangkok';
                    const date = new Date().toLocaleString('th-TH', { timeZone: tz });
                    return `Current date/time (${tz}): ${date}`;
                }
                catch (e) {
                    return 'Error getting current date.';
                }
            }
        });
        console.log(`📦 Loaded ${this.staticTools.size} static tools`);
    }
    getStaticTools() {
        const tools = {};
        for (const [name, meta] of this.staticTools.entries()) {
            tools[name] = meta.func;
        }
        return tools;
    }
    createMemoryTools(sessionId) {
        const memoryTool = new MemoryTool_1.MemoryTool(sessionId);
        return memoryTool.getTools();
    }
    createRetrievalTools(collectionNames) {
        const tools = {};
        for (const collectionName of collectionNames) {
            const retrievalTool = new RetrievalTool_1.RetrievalTool(collectionName);
            const toolMeta = retrievalTool.getToolMeta();
            tools[toolMeta.name] = toolMeta.func;
        }
        console.log(`🔍 Created retrieval tools for ${collectionNames.length} collections`);
        return tools;
    }
    getAllToolsForSession(sessionId, collectionNames = []) {
        const tools = {};
        Object.assign(tools, this.getStaticTools());
        Object.assign(tools, this.createMemoryTools(sessionId));
        if (collectionNames.length > 0) {
            Object.assign(tools, this.createRetrievalTools(collectionNames));
        }
        console.log(`🛠️ Assembled ${Object.keys(tools).length} tools for session ${sessionId}`);
        return tools;
    }
    getAvailableTools() {
        return Array.from(this.staticTools.keys());
    }
    getToolDescription(toolName) {
        const tool = this.staticTools.get(toolName);
        return tool ? tool.description : null;
    }
}
exports.ToolRegistry = ToolRegistry;
exports.toolRegistry = new ToolRegistry();
const createMemoryTool = (sessionId) => exports.toolRegistry.createMemoryTools(sessionId);
exports.createMemoryTool = createMemoryTool;
const createRetrievalTools = (collectionNames) => exports.toolRegistry.createRetrievalTools(collectionNames);
exports.createRetrievalTools = createRetrievalTools;
//# sourceMappingURL=ToolRegistry.js.map