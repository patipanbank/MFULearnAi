"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unifiedToolRegistry = exports.UnifiedToolRegistry = exports.ToolType = exports.ToolCategory = void 0;
const chromaService_1 = require("./chromaService");
const embeddingService_1 = require("./embeddingService");
const langmemService_1 = require("./langmemService");
const axios_1 = __importDefault(require("axios"));
var ToolCategory;
(function (ToolCategory) {
    ToolCategory["CORE"] = "core";
    ToolCategory["SEARCH"] = "search";
    ToolCategory["CALCULATION"] = "calculation";
    ToolCategory["MEMORY"] = "memory";
    ToolCategory["RETRIEVAL"] = "retrieval";
    ToolCategory["INTEGRATION"] = "integration";
    ToolCategory["UTILITY"] = "utility";
    ToolCategory["CUSTOM"] = "custom";
})(ToolCategory || (exports.ToolCategory = ToolCategory = {}));
var ToolType;
(function (ToolType) {
    ToolType["STATIC"] = "static";
    ToolType["DYNAMIC"] = "dynamic";
    ToolType["SESSION_SPECIFIC"] = "session_specific";
    ToolType["COLLECTION_SPECIFIC"] = "collection_specific";
})(ToolType || (exports.ToolType = ToolType = {}));
class UnifiedToolRegistry {
    constructor() {
        this.tools = new Map();
        this.toolFunctions = new Map();
        this.activeTools = new Map();
        this.memoryToolsCreated = new Set();
        this.initializeCorTools();
    }
    static getInstance() {
        if (!UnifiedToolRegistry.instance) {
            UnifiedToolRegistry.instance = new UnifiedToolRegistry();
        }
        return UnifiedToolRegistry.instance;
    }
    registerTool(config, func) {
        if (config.dependencies) {
            for (const dep of config.dependencies) {
                if (!this.tools.has(dep)) {
                    throw new Error(`Tool dependency "${dep}" not found for tool "${config.id}"`);
                }
            }
        }
        this.tools.set(config.id, config);
        this.toolFunctions.set(config.id, func);
        console.log(`🔧 Registered tool: ${config.id} (${config.version})`);
    }
    getAvailableTools(context) {
        const availableTools = [];
        for (const [toolId, config] of this.tools.entries()) {
            if (!config.enabled)
                continue;
            switch (config.type) {
                case ToolType.STATIC:
                    availableTools.push(config);
                    break;
                case ToolType.SESSION_SPECIFIC:
                    if (context.sessionId) {
                        availableTools.push(config);
                    }
                    break;
                case ToolType.COLLECTION_SPECIFIC:
                    if (context.collectionNames && context.collectionNames.length > 0) {
                        availableTools.push(config);
                    }
                    break;
                case ToolType.DYNAMIC:
                    availableTools.push(config);
                    break;
            }
        }
        return availableTools;
    }
    async executeTool(toolId, input, context) {
        const startTime = Date.now();
        try {
            const config = this.tools.get(toolId);
            const func = this.toolFunctions.get(toolId);
            if (!config || !func) {
                return {
                    success: false,
                    result: '',
                    error: `Tool "${toolId}" not found`,
                    executionTime: Date.now() - startTime
                };
            }
            if (!config.enabled) {
                return {
                    success: false,
                    result: '',
                    error: `Tool "${toolId}" is disabled`,
                    executionTime: Date.now() - startTime
                };
            }
            if (context.sessionId) {
                if (!this.activeTools.has(context.sessionId)) {
                    this.activeTools.set(context.sessionId, new Set());
                }
                this.activeTools.get(context.sessionId).add(toolId);
            }
            const result = await func(input, context);
            config.metadata.usage_count++;
            const executionTime = Date.now() - startTime;
            if (config.metadata.performance) {
                const perf = config.metadata.performance;
                perf.averageResponseTime = (perf.averageResponseTime + executionTime) / 2;
                perf.successRate = result.success ?
                    (perf.successRate * 0.9 + 0.1) :
                    (perf.successRate * 0.9);
                perf.lastBenchmark = new Date();
            }
            return {
                ...result,
                executionTime
            };
        }
        catch (error) {
            return {
                success: false,
                result: '',
                error: error.message,
                executionTime: Date.now() - startTime
            };
        }
    }
    createSessionTools(sessionId) {
        const sessionTools = [];
        const embedMemoryConfig = {
            id: `embed_memory_${sessionId}`,
            name: 'Embed to Memory',
            description: 'Store information in conversation memory',
            version: '1.0.0',
            category: ToolCategory.MEMORY,
            type: ToolType.SESSION_SPECIFIC,
            enabled: true,
            config: { sessionId },
            metadata: {
                tags: ['memory', 'embed', 'session'],
                lastUpdated: new Date(),
                usage_count: 0
            }
        };
        this.registerTool(embedMemoryConfig, this.createMemoryToolFunction(embedMemoryConfig.id, sessionId));
        sessionTools.push(embedMemoryConfig);
        return sessionTools;
    }
    async createMemorySearchToolsIfNeeded(sessionId) {
        const memoryTools = [];
        try {
            const recentMessages = await langmemService_1.langmemService.getRecentMessages(sessionId);
            const hasMemory = recentMessages && recentMessages.length > 0;
            if (hasMemory) {
                const memoryToolConfigs = [
                    {
                        id: `search_memory_${sessionId}`,
                        name: 'Search Chat Memory',
                        description: 'Search through conversation history for this session',
                        version: '1.0.0',
                        category: ToolCategory.MEMORY,
                        type: ToolType.SESSION_SPECIFIC,
                        enabled: true,
                        config: { sessionId },
                        metadata: {
                            tags: ['memory', 'search', 'session'],
                            lastUpdated: new Date(),
                            usage_count: 0
                        }
                    },
                    {
                        id: `get_recent_context_${sessionId}`,
                        name: 'Get Recent Context',
                        description: 'Get recent conversation context',
                        version: '1.0.0',
                        category: ToolCategory.MEMORY,
                        type: ToolType.SESSION_SPECIFIC,
                        enabled: true,
                        config: { sessionId },
                        metadata: {
                            tags: ['memory', 'context', 'session'],
                            lastUpdated: new Date(),
                            usage_count: 0
                        }
                    }
                ];
                for (const config of memoryToolConfigs) {
                    if (!this.tools.has(config.id)) {
                        this.registerTool(config, this.createMemoryToolFunction(config.id, sessionId));
                        memoryTools.push(config);
                    }
                }
                if (memoryTools.length > 0 && !this.memoryToolsCreated.has(sessionId)) {
                    this.memoryToolsCreated.add(sessionId);
                    console.log(`🧠 Memory search tools activated for session ${sessionId}`);
                }
            }
        }
        catch (error) {
            console.error(`❌ Error checking memory for session ${sessionId}:`, error);
        }
        return memoryTools;
    }
    createCollectionTools(collectionNames) {
        const collectionTools = [];
        for (const collectionName of collectionNames) {
            const toolConfig = {
                id: `search_${collectionName}`,
                name: `Search ${collectionName}`,
                description: `Search and retrieve information from the ${collectionName} knowledge base`,
                version: '1.0.0',
                category: ToolCategory.RETRIEVAL,
                type: ToolType.COLLECTION_SPECIFIC,
                enabled: true,
                config: { collectionName },
                metadata: {
                    tags: ['search', 'knowledge', 'collection'],
                    lastUpdated: new Date(),
                    usage_count: 0
                }
            };
            this.registerTool(toolConfig, this.createCollectionSearchFunction(collectionName));
            collectionTools.push(toolConfig);
        }
        return collectionTools;
    }
    cleanupSessionTools(sessionId) {
        const keysToDelete = [];
        for (const [toolId, config] of this.tools.entries()) {
            if (config.type === ToolType.SESSION_SPECIFIC &&
                config.config.sessionId === sessionId) {
                keysToDelete.push(toolId);
            }
        }
        for (const toolId of keysToDelete) {
            this.tools.delete(toolId);
            this.toolFunctions.delete(toolId);
        }
        this.activeTools.delete(sessionId);
        console.log(`🧹 Cleaned up ${keysToDelete.length} session tools for ${sessionId}`);
    }
    getToolStatistics() {
        const stats = {
            totalTools: this.tools.size,
            enabledTools: 0,
            toolsByCategory: {},
            toolsByType: {},
            activeSessions: this.activeTools.size,
            totalUsage: 0
        };
        for (const config of this.tools.values()) {
            if (config.enabled)
                stats.enabledTools++;
            stats.toolsByCategory[config.category] = (stats.toolsByCategory[config.category] || 0) + 1;
            stats.toolsByType[config.type] = (stats.toolsByType[config.type] || 0) + 1;
            stats.totalUsage += config.metadata.usage_count;
        }
        return stats;
    }
    initializeCorTools() {
        this.registerTool({
            id: 'web_search',
            name: 'Web Search',
            description: 'Search the web for current information using Google Search API or DuckDuckGo fallback',
            version: '2.0.0',
            category: ToolCategory.SEARCH,
            type: ToolType.STATIC,
            enabled: true,
            config: {
                providers: ['google', 'duckduckgo'],
                timeout: 7000,
                maxResults: 3
            },
            metadata: {
                tags: ['web', 'search', 'information'],
                documentation: 'Search the internet for up-to-date information on any topic',
                examples: [
                    {
                        input: 'latest news about AI technology',
                        expectedOutput: 'Recent news articles about AI technology developments',
                        description: 'Get current news and updates'
                    }
                ],
                performance: {
                    averageResponseTime: 2000,
                    successRate: 0.95,
                    lastBenchmark: new Date()
                },
                lastUpdated: new Date(),
                usage_count: 0
            }
        }, this.createWebSearchFunction());
        this.registerTool({
            id: 'calculator',
            name: 'Calculator',
            description: 'Perform mathematical calculations and expressions safely',
            version: '2.0.0',
            category: ToolCategory.CALCULATION,
            type: ToolType.STATIC,
            enabled: true,
            config: {
                allowedOperations: ['+', '-', '*', '/', '(', ')', '.'],
                maxInputLength: 200
            },
            metadata: {
                tags: ['math', 'calculation', 'arithmetic'],
                documentation: 'Evaluate mathematical expressions safely',
                examples: [
                    {
                        input: '2 + 2 * 3',
                        expectedOutput: '8',
                        description: 'Basic arithmetic with order of operations'
                    }
                ],
                performance: {
                    averageResponseTime: 10,
                    successRate: 0.99,
                    lastBenchmark: new Date()
                },
                lastUpdated: new Date(),
                usage_count: 0
            }
        }, this.createCalculatorFunction());
        this.registerTool({
            id: 'current_date',
            name: 'Current Date',
            description: 'Get current date and time with timezone support',
            version: '2.0.0',
            category: ToolCategory.UTILITY,
            type: ToolType.STATIC,
            enabled: true,
            config: {
                defaultTimezone: 'Asia/Bangkok',
                supportedTimezones: ['Asia/Bangkok', 'UTC', 'America/New_York', 'Europe/London']
            },
            metadata: {
                tags: ['date', 'time', 'utility'],
                documentation: 'Get current date and time in specified timezone',
                examples: [
                    {
                        input: '',
                        expectedOutput: 'Current date/time (Asia/Bangkok): 2024-01-01 12:00:00',
                        description: 'Get current date and time'
                    }
                ],
                performance: {
                    averageResponseTime: 5,
                    successRate: 1.0,
                    lastBenchmark: new Date()
                },
                lastUpdated: new Date(),
                usage_count: 0
            }
        }, this.createCurrentDateFunction());
        console.log('🔧 Initialized core tools');
    }
    createWebSearchFunction() {
        return async (input, context) => {
            if (!input || input.trim() === '') {
                return {
                    success: false,
                    result: '',
                    error: 'No search query provided'
                };
            }
            try {
                console.log(`🔍 Web search query: ${input}`);
                if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) {
                    console.log(`🔍 Using Google Search API`);
                    const gUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(input)}&num=3`;
                    const gResp = await axios_1.default.get(gUrl, { timeout: 7000 });
                    if (gResp.data && gResp.data.items && gResp.data.items.length > 0) {
                        const results = gResp.data.items.map((item, i) => `${i + 1}. ${item.title}\n${item.snippet}\n${item.link}`).join('\n\n');
                        return {
                            success: true,
                            result: results,
                            executionTime: 0,
                            metadata: { provider: 'google', resultCount: gResp.data.items.length }
                        };
                    }
                }
                console.log(`🔍 Using DuckDuckGo API`);
                const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(input)}&format=json&no_html=1&skip_disambig=1`;
                const resp = await axios_1.default.get(url, { timeout: 5000 });
                if (resp.data && resp.data.Abstract) {
                    return {
                        success: true,
                        result: `DuckDuckGo: ${resp.data.Abstract}`,
                        executionTime: 0,
                        metadata: { provider: 'duckduckgo', hasAbstract: true }
                    };
                }
                if (resp.data && resp.data.RelatedTopics && resp.data.RelatedTopics.length > 0) {
                    const topics = resp.data.RelatedTopics.slice(0, 3).map((t) => t.Text).filter(Boolean);
                    if (topics.length > 0) {
                        return {
                            success: true,
                            result: `DuckDuckGo related: ${topics.join(' | ')}`,
                            executionTime: 0,
                            metadata: { provider: 'duckduckgo', hasRelatedTopics: true }
                        };
                    }
                }
                return {
                    success: false,
                    result: '',
                    error: 'No specific results found from any search provider'
                };
            }
            catch (error) {
                return {
                    success: false,
                    result: '',
                    error: `Web search error: ${error.message}`
                };
            }
        };
    }
    createCalculatorFunction() {
        return async (input, context) => {
            if (!input || input.trim() === '') {
                return {
                    success: false,
                    result: '',
                    error: 'No mathematical expression provided'
                };
            }
            try {
                if (!/^[-+*/().\d\s]+$/.test(input)) {
                    return {
                        success: false,
                        result: '',
                        error: 'Invalid mathematical expression - only numbers and basic operators allowed'
                    };
                }
                const result = Function(`"use strict"; return (${input})`)();
                return {
                    success: true,
                    result: result.toString(),
                    executionTime: 0,
                    metadata: { expression: input, resultType: typeof result }
                };
            }
            catch (error) {
                return {
                    success: false,
                    result: '',
                    error: `Calculation error: ${error.message}`
                };
            }
        };
    }
    createCurrentDateFunction() {
        return async (input, context) => {
            try {
                const timezone = context.config?.timezone || 'Asia/Bangkok';
                const date = new Date().toLocaleString('th-TH', { timeZone: timezone });
                return {
                    success: true,
                    result: `Current date/time (${timezone}): ${date}`,
                    executionTime: 0,
                    metadata: { timezone, timestamp: new Date().toISOString() }
                };
            }
            catch (error) {
                return {
                    success: false,
                    result: '',
                    error: `Error getting current date: ${error.message}`
                };
            }
        };
    }
    createMemoryToolFunction(toolId, sessionId) {
        return async (input, context) => {
            try {
                if (toolId.includes('search_memory')) {
                    const results = await langmemService_1.langmemService.searchMemory(sessionId, input);
                    if (!results.length) {
                        return {
                            success: true,
                            result: 'No relevant chat history found',
                            executionTime: 0,
                            metadata: { searchQuery: input, resultCount: 0 }
                        };
                    }
                    const formattedResults = results.map((r, i) => `${i + 1}. ${r.role}: ${r.content}`).join('\n');
                    return {
                        success: true,
                        result: formattedResults,
                        executionTime: 0,
                        metadata: { searchQuery: input, resultCount: results.length }
                    };
                }
                else if (toolId.includes('embed_memory')) {
                    await langmemService_1.langmemService.embedMessage(sessionId, input);
                    return {
                        success: true,
                        result: 'Message embedded into memory successfully',
                        executionTime: 0,
                        metadata: { embeddedContent: input }
                    };
                }
                else if (toolId.includes('get_recent_context')) {
                    const recent = await langmemService_1.langmemService.getRecentMessages(sessionId);
                    if (!recent.length) {
                        return {
                            success: true,
                            result: 'No recent context found',
                            executionTime: 0,
                            metadata: { resultCount: 0 }
                        };
                    }
                    const formattedRecent = recent.map((msg, i) => `${i + 1}. ${msg.role}: ${msg.content}`).join('\n');
                    return {
                        success: true,
                        result: formattedRecent,
                        executionTime: 0,
                        metadata: { resultCount: recent.length }
                    };
                }
                return {
                    success: false,
                    result: '',
                    error: 'Unknown memory tool operation'
                };
            }
            catch (error) {
                return {
                    success: false,
                    result: '',
                    error: `Memory tool error: ${error.message}`
                };
            }
        };
    }
    createCollectionSearchFunction(collectionName) {
        return async (input, context) => {
            try {
                const queryEmbedding = await embeddingService_1.embeddingService.embed(input);
                if (!queryEmbedding || queryEmbedding.length === 0) {
                    return {
                        success: false,
                        result: '',
                        error: 'Failed to generate embedding for search query'
                    };
                }
                const results = await chromaService_1.chromaService.queryCollection(collectionName, [queryEmbedding], 5);
                if (!results || !results.documents || results.documents.length === 0) {
                    return {
                        success: true,
                        result: `No information found in ${collectionName} for: ${input}`,
                        executionTime: 0,
                        metadata: { collectionName, searchQuery: input, resultCount: 0 }
                    };
                }
                const documents = results.documents.flat();
                const metadatas = results.metadatas ? results.metadatas.flat() : [];
                const formattedResults = documents.map((doc, i) => {
                    const metadata = metadatas[i] || {};
                    const sourceName = metadata?.source || `${collectionName}_document_${i + 1}`;
                    const sourceType = metadata?.source_type || 'unknown';
                    const uploadedBy = metadata?.uploadedBy;
                    let sourceInfo = `Source: ${sourceName}`;
                    if (sourceType && sourceType !== 'unknown') {
                        sourceInfo += ` (${sourceType})`;
                    }
                    if (uploadedBy && uploadedBy !== 'system') {
                        sourceInfo += ` [Uploaded by: ${uploadedBy}]`;
                    }
                    return `${i + 1}. ${doc || 'No content'}\n${sourceInfo}`;
                }).join('\n\n');
                return {
                    success: true,
                    result: formattedResults,
                    executionTime: 0,
                    metadata: {
                        collectionName,
                        searchQuery: input,
                        resultCount: documents.length
                    }
                };
            }
            catch (error) {
                return {
                    success: false,
                    result: '',
                    error: `Collection search error: ${error.message}`
                };
            }
        };
    }
}
exports.UnifiedToolRegistry = UnifiedToolRegistry;
exports.unifiedToolRegistry = UnifiedToolRegistry.getInstance();
//# sourceMappingURL=unifiedToolRegistry.js.map