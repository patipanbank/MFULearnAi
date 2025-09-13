"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryTool = void 0;
class MemoryTool {
    constructor(sessionId) {
        this.sessionId = sessionId;
    }
    getTools() {
        return {
            'memory_store': this.createStoreFunction(),
            'memory_search': this.createSearchFunction(),
            'memory_list': this.createListFunction()
        };
    }
    createStoreFunction() {
        return async (input, sessionId) => {
            try {
                const actualSessionId = sessionId || this.sessionId;
                let key, value;
                if (input.includes(':') && !input.startsWith('{')) {
                    const parts = input.split(':');
                    key = parts[0].trim();
                    value = parts.slice(1).join(':').trim();
                }
                else {
                    try {
                        const parsed = JSON.parse(input);
                        key = parsed.key;
                        value = parsed.value;
                    }
                    catch {
                        return 'Error: Invalid format. Use "key:value" or {"key":"...", "value":"..."}';
                    }
                }
                if (!key || !value) {
                    return 'Error: Both key and value are required';
                }
                const { memoryService } = await Promise.resolve().then(() => __importStar(require('../../services/memoryService')));
                await memoryService.storeMemory(actualSessionId, key, value);
                return `✅ Stored memory: "${key}" = "${value}"`;
            }
            catch (error) {
                console.error('Memory store error:', error);
                return `Error storing memory: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        };
    }
    createSearchFunction() {
        return async (query, sessionId) => {
            try {
                const actualSessionId = sessionId || this.sessionId;
                const { memoryService } = await Promise.resolve().then(() => __importStar(require('../../services/memoryService')));
                const results = await memoryService.searchMemories(actualSessionId, query);
                if (results.length === 0) {
                    return `No memories found for: "${query}"`;
                }
                const formatted = results.map((result, index) => `${index + 1}. ${result.key}: ${result.value}\n   (Stored: ${new Date(result.timestamp).toLocaleString()})`).join('\n\n');
                return `Found ${results.length} memory(ies) for "${query}":\n\n${formatted}`;
            }
            catch (error) {
                console.error('Memory search error:', error);
                return `Error searching memory: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        };
    }
    createListFunction() {
        return async (_input, sessionId) => {
            try {
                const actualSessionId = sessionId || this.sessionId;
                const { memoryService } = await Promise.resolve().then(() => __importStar(require('../../services/memoryService')));
                const memories = await memoryService.getAllMemories(actualSessionId);
                if (memories.length === 0) {
                    return 'No memories stored for this session';
                }
                const formatted = memories.map((memory, index) => `${index + 1}. ${memory.key}: ${memory.value.substring(0, 50)}${memory.value.length > 50 ? '...' : ''}`).join('\n');
                return `All memories for this session (${memories.length} total):\n\n${formatted}`;
            }
            catch (error) {
                console.error('Memory list error:', error);
                return `Error listing memories: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        };
    }
}
exports.MemoryTool = MemoryTool;
//# sourceMappingURL=MemoryTool.js.map