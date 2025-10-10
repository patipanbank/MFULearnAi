export type ToolFunction = (input: string, sessionId?: string, config?: any) => Promise<string>;
export interface ToolMeta {
    name: string;
    description: string;
    func: ToolFunction;
}
/**
 * toolRegistry: รวม tool registry สำหรับ agent (เหมือน backend-legacy/agents/tool_registry.py)
 * - รองรับ web_search, calculator, current_date, memory_search, memory_embed, dynamic tool ฯลฯ
 * - เชื่อมต่อกับ service จริง (ไม่ mock)
 * - มี description/meta
 * - เพิ่ม hybrid memory management
 */
export declare const toolRegistry: Record<string, ToolMeta>;
/** Web Search Result type */
export interface WebSearchResult {
    title: string;
    snippet: string;
    url: string;
}
/**
 * Web search tool (TypeScript best practice)
 * - รองรับ DuckDuckGo, Google (fallback)
 * - ปลอดภัย, ขยาย provider ได้ง่าย
 * - รองรับ config: { provider?: 'duckduckgo' | 'google', language?: string }
 */
export declare const webSearchTool: ToolMeta;
/**
 * Create memory tools for session (เหมือน Legacy)
 * - Hybrid approach: Redis for recent, Vectorstore for long-term
 * - Dynamic tool creation based on session
 */
export declare function createMemoryTool(sessionId: string): {
    [x: string]: {
        name: string;
        description: string;
        func: (input: string) => Promise<any>;
    };
};
/**
 * Create retrieval tools for collections (เหมือน Legacy)
 * - Dynamic tool creation based on collection names
 * - Vectorstore search with embeddings
 */
export declare function createRetrievalTools(collectionNames: string[]): Record<string, ToolMeta>;
export declare function addChatMemory(sessionId: string, messages: {
    role: string;
    content: string;
    id?: string;
    timestamp?: string;
}[]): Promise<void>;
export declare function clearChatMemory(sessionId: string): Promise<void>;
export declare function getMemoryStats(sessionId: string): Promise<{
    recentCount: any;
    totalCount: any;
    sessionId: string;
    error?: undefined;
} | {
    error: string;
    recentCount?: undefined;
    totalCount?: undefined;
    sessionId?: undefined;
}>;
//# sourceMappingURL=toolRegistry.d.ts.map