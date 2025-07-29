import axios from 'axios';
import { DynamicTool } from "@langchain/core/tools";
import { BedrockEmbeddings } from "@langchain/community/embeddings/bedrock";
import { chromaService } from "./chromaService";

export interface AdvancedToolConfig {
  weatherApiKey?: string;
  translateApiKey?: string;
  newsApiKey?: string;
}

export class AdvancedToolService {
  private tools: Map<string, DynamicTool> = new Map();
  private config: AdvancedToolConfig;

  constructor(config: AdvancedToolConfig = {}) {
    this.config = config;
    this.initializeTools();
  }

  private initializeTools(): void {
    // Weather Tool
    this.tools.set('weather', new DynamicTool({
      name: 'weather',
      description: 'Get current weather information for a location',
      func: async (input: string) => {
        try {
          const location = input.trim();
          if (!this.config.weatherApiKey) {
            return 'Weather API key not configured';
          }
          
          const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${this.config.weatherApiKey}&units=metric`
          );
          
          const data = response.data;
          return `Weather in ${data.name}: ${data.weather[0].description}, Temperature: ${data.main.temp}°C, Humidity: ${data.main.humidity}%`;
        } catch (error) {
          return `Error getting weather: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
    }));

    // Translation Tool
    this.tools.set('translate', new DynamicTool({
      name: 'translate',
      description: 'Translate text between languages',
      func: async (input: string) => {
        try {
          // Simple translation using Google Translate API (requires API key)
          if (!this.config.translateApiKey) {
            return 'Translation API key not configured';
          }
          
          // This is a placeholder - you would implement actual translation logic
          return `Translation service not fully implemented. Input: ${input}`;
        } catch (error) {
          return `Error translating: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
    }));

    // Currency Converter Tool
    this.tools.set('currency_converter', new DynamicTool({
      name: 'currency_converter',
      description: 'Convert between different currencies',
      func: async (input: string) => {
        try {
          // Simple currency conversion using a free API
          const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
          const rates = response.data.rates;
          
          // Parse input like "100 USD to EUR"
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
        } catch (error) {
          return `Error converting currency: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
    }));

    // News Search Tool
    this.tools.set('news_search', new DynamicTool({
      name: 'news_search',
      description: 'Search for recent news articles',
      func: async (input: string) => {
        try {
          if (!this.config.newsApiKey) {
            return 'News API key not configured';
          }
          
          const response = await axios.get(
            `https://newsapi.org/v2/everything?q=${encodeURIComponent(input)}&apiKey=${this.config.newsApiKey}&pageSize=5`
          );
          
          const articles = response.data.articles;
          if (articles && articles.length > 0) {
            return articles.map((article: any) => 
              `${article.title} - ${article.url}`
            ).join('\n');
          }
          
          return 'No news articles found';
        } catch (error) {
          return `Error searching news: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
    }));

    // Code Analysis Tool
    this.tools.set('code_analysis', new DynamicTool({
      name: 'code_analysis',
      description: 'Analyze and review code for potential issues',
      func: async (input: string) => {
        try {
          // Simple code analysis (placeholder)
          const lines = input.split('\n');
          const issues = [];
          
          // Check for common issues
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
        } catch (error) {
          return `Error analyzing code: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
    }));

    // File Operations Tool (Safe)
    this.tools.set('file_operations', new DynamicTool({
      name: 'file_operations',
      description: 'Perform safe file operations (read only)',
      func: async (input: string) => {
        try {
          // Only allow safe operations
          const command = input.toLowerCase();
          
          if (command.includes('read') || command.includes('list')) {
            return 'File read operations are available but not implemented in this demo';
          }
          
          if (command.includes('write') || command.includes('delete') || command.includes('modify')) {
            return 'Write operations are disabled for security reasons';
          }
          
          return 'Please specify a read operation (e.g., "read filename.txt")';
        } catch (error) {
          return `Error with file operation: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
    }));

    // Database Query Tool (Read-only)
    this.tools.set('database_query', new DynamicTool({
      name: 'database_query',
      description: 'Query database for information (read-only)',
      func: async (input: string) => {
        try {
          const query = input.toLowerCase();
          
          if (query.includes('select') || query.includes('read')) {
            return 'Database read queries are available but not implemented in this demo';
          }
          
          if (query.includes('insert') || query.includes('update') || query.includes('delete')) {
            return 'Write operations are disabled for security reasons';
          }
          
          return 'Please specify a SELECT query for reading data';
        } catch (error) {
          return `Error with database query: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
    }));
  }

  getTool(name: string): DynamicTool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): DynamicTool[] {
    return Array.from(this.tools.values());
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  // Helper method to validate file paths for security
  private validatePath(path: string): boolean {
    const dangerousPatterns = [
      /\.\./, // Path traversal
      /\/etc\//, // System directories
      /\/var\//,
      /\/usr\//,
      /\/bin\//,
      /\/sbin\//,
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(path));
  }
}

// Export singleton instance
export const advancedToolService = new AdvancedToolService({
  weatherApiKey: process.env.OPENWEATHER_API_KEY,
  translateApiKey: process.env.GOOGLE_TRANSLATE_API_KEY,
  newsApiKey: process.env.NEWS_API_KEY,
}); 