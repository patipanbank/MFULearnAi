"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ToolService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolService = void 0;
const common_1 = require("@nestjs/common");
const chroma_service_1 = require("../../services/chroma.service");
const bedrock_service_1 = require("../../infrastructure/bedrock/bedrock.service");
let ToolService = ToolService_1 = class ToolService {
    constructor(chromaService, bedrockService) {
        this.chromaService = chromaService;
        this.bedrockService = bedrockService;
        this.logger = new common_1.Logger(ToolService_1.name);
        this.tools = new Map();
        this.initializeTools();
    }
    initializeTools() {
        this.registerTool({
            name: 'calculator',
            description: 'Performs mathematical calculations. Supports basic arithmetic operations (+, -, *, /, %, ^) and functions like sqrt, sin, cos, tan, log, etc.',
            inputSchema: {
                type: 'object',
                properties: {
                    expression: {
                        type: 'string',
                        description: 'Mathematical expression to evaluate (e.g., "2 + 3 * 4", "sqrt(16)", "sin(30)")'
                    }
                },
                required: ['expression']
            },
            execute: this.calculateExpression.bind(this)
        });
        this.registerTool({
            name: 'web_search',
            description: 'Searches the web for current information on any topic. Useful for getting up-to-date information, news, or facts.',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query for finding relevant information'
                    },
                    limit: {
                        type: 'number',
                        description: 'Maximum number of results to return (default: 5)',
                        default: 5
                    }
                },
                required: ['query']
            },
            execute: this.searchWeb.bind(this)
        });
        this.registerTool({
            name: 'document_search',
            description: 'Searches through document collections to find relevant information. Useful for finding specific information from uploaded documents.',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query for finding relevant documents'
                    },
                    collection: {
                        type: 'string',
                        description: 'Document collection name to search in'
                    },
                    limit: {
                        type: 'number',
                        description: 'Maximum number of results to return (default: 5)',
                        default: 5
                    }
                },
                required: ['query', 'collection']
            },
            execute: this.searchDocuments.bind(this)
        });
        this.registerTool({
            name: 'text_summary',
            description: 'Summarizes long text content into concise key points. Useful for processing large amounts of text.',
            inputSchema: {
                type: 'object',
                properties: {
                    text: {
                        type: 'string',
                        description: 'Text content to summarize'
                    },
                    max_length: {
                        type: 'number',
                        description: 'Maximum length of summary in words (default: 100)',
                        default: 100
                    }
                },
                required: ['text']
            },
            execute: this.summarizeText.bind(this)
        });
        this.registerTool({
            name: 'current_time',
            description: 'Gets the current date and time. Useful for time-sensitive information or scheduling.',
            inputSchema: {
                type: 'object',
                properties: {
                    timezone: {
                        type: 'string',
                        description: 'Timezone (default: Asia/Bangkok)',
                        default: 'Asia/Bangkok'
                    },
                    format: {
                        type: 'string',
                        description: 'Date format (iso, local, custom)',
                        default: 'iso'
                    }
                }
            },
            execute: this.getCurrentTime.bind(this)
        });
        this.logger.log(`🔧 Initialized ${this.tools.size} tools: ${Array.from(this.tools.keys()).join(', ')}`);
    }
    registerTool(tool) {
        this.tools.set(tool.name, tool);
        this.logger.debug(`✅ Registered tool: ${tool.name}`);
    }
    getTool(name) {
        return this.tools.get(name);
    }
    getAllTools() {
        return Array.from(this.tools.values());
    }
    getToolNames() {
        return Array.from(this.tools.keys());
    }
    async executeTool(name, params) {
        const tool = this.getTool(name);
        if (!tool) {
            return {
                success: false,
                error: `Tool '${name}' not found`
            };
        }
        try {
            this.logger.debug(`🔧 Executing tool: ${name} with params:`, params);
            const result = await tool.execute(params);
            this.logger.debug(`✅ Tool ${name} executed successfully`);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Tool ${name} execution failed:`, errorMessage);
            return {
                success: false,
                error: `Tool execution failed: ${errorMessage}`
            };
        }
    }
    async calculateExpression(params) {
        try {
            const { expression } = params;
            const safeExpression = expression.replace(/[^0-9+\-*/().\s\w]/g, '');
            const result = this.evaluateMathExpression(safeExpression);
            return {
                success: true,
                data: {
                    expression,
                    result,
                    type: typeof result
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Calculation error: ${error instanceof Error ? error.message : 'Invalid expression'}`
            };
        }
    }
    evaluateMathExpression(expression) {
        const cleanExpression = expression.replace(/\s/g, '');
        try {
            return Function(`"use strict"; return (${cleanExpression})`)();
        }
        catch {
            throw new Error('Invalid mathematical expression');
        }
    }
    async searchWeb(params) {
        try {
            const { query, limit = 5 } = params;
            const results = [
                {
                    title: `Search results for: ${query}`,
                    url: 'https://example.com',
                    snippet: `This is a mock search result for the query: ${query}`,
                    timestamp: new Date().toISOString()
                }
            ];
            return {
                success: true,
                data: {
                    query,
                    results: results.slice(0, limit),
                    count: results.length
                },
                metadata: {
                    search_time: new Date().toISOString(),
                    total_results: results.length
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    async searchDocuments(params) {
        try {
            const { query, collection, limit = 5 } = params;
            const queryEmbedding = await this.bedrockService.createTextEmbedding(query);
            if (!queryEmbedding || queryEmbedding.length === 0) {
                throw new Error('Failed to create query embedding');
            }
            const searchResults = await this.chromaService.queryCollection(collection, queryEmbedding, limit);
            return {
                success: true,
                data: {
                    query,
                    collection,
                    results: (searchResults === null || searchResults === void 0 ? void 0 : searchResults.documents) || [],
                    metadata: (searchResults === null || searchResults === void 0 ? void 0 : searchResults.metadatas) || [],
                    distances: (searchResults === null || searchResults === void 0 ? void 0 : searchResults.distances) || []
                },
                metadata: {
                    search_time: new Date().toISOString(),
                    collection_name: collection
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Document search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    async summarizeText(params) {
        try {
            const { text, max_length = 100 } = params;
            if (!text || text.length === 0) {
                throw new Error('Text content is required');
            }
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
            const wordsPerSentence = max_length / Math.min(sentences.length, 3);
            let summary = '';
            let wordCount = 0;
            for (const sentence of sentences) {
                const words = sentence.trim().split(/\s+/);
                if (wordCount + words.length <= max_length) {
                    summary += sentence.trim() + '. ';
                    wordCount += words.length;
                }
                else {
                    break;
                }
            }
            return {
                success: true,
                data: {
                    original_length: text.length,
                    summary: summary.trim(),
                    summary_length: summary.trim().length,
                    word_count: wordCount,
                    compression_ratio: Math.round((summary.length / text.length) * 100)
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Text summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    async getCurrentTime(params = {}) {
        try {
            const { timezone = 'Asia/Bangkok', format = 'iso' } = params;
            const now = new Date();
            let formattedTime;
            switch (format) {
                case 'iso':
                    formattedTime = now.toISOString();
                    break;
                case 'local':
                    formattedTime = now.toLocaleString('en-US', { timeZone: timezone });
                    break;
                default:
                    formattedTime = now.toISOString();
            }
            return {
                success: true,
                data: {
                    timestamp: formattedTime,
                    timezone,
                    unix_timestamp: Math.floor(now.getTime() / 1000),
                    day_of_week: now.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }),
                    month: now.toLocaleDateString('en-US', { month: 'long', timeZone: timezone })
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Time retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
};
exports.ToolService = ToolService;
exports.ToolService = ToolService = ToolService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [chroma_service_1.ChromaService,
        bedrock_service_1.BedrockService])
], ToolService);
//# sourceMappingURL=tool.service.js.map