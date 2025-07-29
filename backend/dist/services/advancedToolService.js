"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.advancedToolService = exports.AdvancedToolService = void 0;
const axios_1 = __importDefault(require("axios"));
const tools_1 = require("langchain/tools");
class AdvancedToolService {
    constructor(config = {}) {
        this.tools = new Map();
        this.config = config;
        this.initializeTools();
    }
    initializeTools() {
        this.tools.set('weather', new tools_1.Tool({
            name: 'weather',
            description: 'Get current weather information for a location',
            func: async (input) => {
                try {
                    const location = input.trim();
                    if (!this.config.weatherApiKey) {
                        return 'Weather API key not configured';
                    }
                    const response = await axios_1.default.get(`https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${this.config.weatherApiKey}&units=metric`);
                    const data = response.data;
                    return `Weather in ${data.name}: ${data.weather[0].description}, Temperature: ${data.main.temp}°C, Humidity: ${data.main.humidity}%`;
                }
                catch (error) {
                    return `Error getting weather: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
            },
        }));
        this.tools.set('translate', new tools_1.Tool({
            name: 'translate',
            description: 'Translate text between languages',
            func: async (input) => {
                try {
                    if (!this.config.translateApiKey) {
                        return 'Translation API key not configured';
                    }
                    return `Translation service not fully implemented. Input: ${input}`;
                }
                catch (error) {
                    return `Error translating: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
            },
        }));
        this.tools.set('currency_converter', new tools_1.Tool({
            name: 'currency_converter',
            description: 'Convert between different currencies',
            func: async (input) => {
                try {
                    const response = await axios_1.default.get('https://api.exchangerate-api.com/v4/latest/USD');
                    const rates = response.data.rates;
                    const match = input.match(/(\d+(?:\.\d+)?)\s+(\w+)\s+to\s+(\w+)/i);
                    if (!match) {
                        return 'Please provide input in format: "amount currency to currency" (e.g., "100 USD to EUR")';
                    }
                    const amount = parseFloat(match[1]);
                    const fromCurrency = match[2].toUpperCase();
                    const toCurrency = match[3].toUpperCase();
                    if (fromCurrency === 'USD') {
                        const rate = rates[toCurrency];
                        if (rate) {
                            return `${amount} ${fromCurrency} = ${(amount * rate).toFixed(2)} ${toCurrency}`;
                        }
                    }
                    return `Currency conversion not available for ${fromCurrency} to ${toCurrency}`;
                }
                catch (error) {
                    return `Error converting currency: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
            },
        }));
        this.tools.set('news_search', new tools_1.Tool({
            name: 'news_search',
            description: 'Search for recent news articles',
            func: async (input) => {
                try {
                    if (!this.config.newsApiKey) {
                        return 'News API key not configured';
                    }
                    const response = await axios_1.default.get(`https://newsapi.org/v2/everything?q=${encodeURIComponent(input)}&apiKey=${this.config.newsApiKey}&pageSize=5`);
                    const articles = response.data.articles;
                    if (articles && articles.length > 0) {
                        return articles.map((article) => `${article.title} - ${article.url}`).join('\n');
                    }
                    return 'No news articles found';
                }
                catch (error) {
                    return `Error searching news: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
            },
        }));
        this.tools.set('code_analysis', new tools_1.Tool({
            name: 'code_analysis',
            description: 'Analyze and review code for potential issues',
            func: async (input) => {
                try {
                    const lines = input.split('\n');
                    const issues = [];
                    if (input.includes('console.log')) {
                        issues.push('Consider removing console.log statements in production');
                    }
                    if (input.includes('TODO')) {
                        issues.push('Found TODO comments that should be addressed');
                    }
                    if (input.includes('password') && input.includes('=')) {
                        issues.push('Potential hardcoded password detected');
                    }
                    if (issues.length === 0) {
                        return 'Code analysis completed. No obvious issues found.';
                    }
                    return `Code analysis found ${issues.length} potential issues:\n${issues.join('\n')}`;
                }
                catch (error) {
                    return `Error analyzing code: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
            },
        }));
        this.tools.set('file_operations', new tools_1.Tool({
            name: 'file_operations',
            description: 'Perform safe file operations (read only)',
            func: async (input) => {
                try {
                    const command = input.toLowerCase();
                    if (command.includes('read') || command.includes('list')) {
                        return 'File read operations are available but not implemented in this demo';
                    }
                    if (command.includes('write') || command.includes('delete') || command.includes('modify')) {
                        return 'Write operations are disabled for security reasons';
                    }
                    return 'Please specify a read operation (e.g., "read filename.txt")';
                }
                catch (error) {
                    return `Error with file operation: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
            },
        }));
        this.tools.set('database_query', new tools_1.Tool({
            name: 'database_query',
            description: 'Query database for information (read-only)',
            func: async (input) => {
                try {
                    const query = input.toLowerCase();
                    if (query.includes('select') || query.includes('read')) {
                        return 'Database read queries are available but not implemented in this demo';
                    }
                    if (query.includes('insert') || query.includes('update') || query.includes('delete')) {
                        return 'Write operations are disabled for security reasons';
                    }
                    return 'Please specify a SELECT query for reading data';
                }
                catch (error) {
                    return `Error with database query: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
            },
        }));
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
    validatePath(path) {
        const dangerousPatterns = [
            /\.\./,
            /\/etc\//,
            /\/var\//,
            /\/usr\//,
            /\/bin\//,
            /\/sbin\//,
        ];
        return !dangerousPatterns.some(pattern => pattern.test(path));
    }
}
exports.AdvancedToolService = AdvancedToolService;
exports.advancedToolService = new AdvancedToolService({
    weatherApiKey: process.env.OPENWEATHER_API_KEY,
    translateApiKey: process.env.GOOGLE_TRANSLATE_API_KEY,
    newsApiKey: process.env.NEWS_API_KEY,
});
//# sourceMappingURL=advancedToolService.js.map