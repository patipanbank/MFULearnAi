"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSearchTool = void 0;
class WebSearchTool {
    getToolMeta() {
        return {
            name: 'web_search',
            description: 'Search the web for current information. Use this when you need real-time data, recent events, or information that might not be in your training data.',
            func: async (query, _sessionId) => {
                try {
                    const apiKey = process.env.GOOGLE_API_KEY;
                    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
                    if (!apiKey || !searchEngineId) {
                        throw new Error('Google API credentials not configured');
                    }
                    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}`;
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`Search API error: ${response.status}`);
                    }
                    const data = await response.json();
                    if (!data.items || data.items.length === 0) {
                        return `No search results found for: "${query}"`;
                    }
                    const results = data.items.slice(0, 5).map((item, index) => `${index + 1}. ${item.title}\n   ${item.snippet}\n   URL: ${item.link}\n`).join('\n');
                    return `Search results for "${query}":\n\n${results}`;
                }
                catch (error) {
                    console.error('Web search error:', error);
                    return `Error searching the web: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
            }
        };
    }
}
exports.WebSearchTool = WebSearchTool;
//# sourceMappingURL=WebSearchTool.js.map