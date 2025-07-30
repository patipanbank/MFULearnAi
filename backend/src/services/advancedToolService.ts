import axios from 'axios';
import { Tool } from "@langchain/core/tools";
import { BedrockEmbeddings } from "@langchain/community/embeddings/bedrock";
import { chromaService } from "./chromaService";

export interface AdvancedToolConfig {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export class AdvancedToolService {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.initializeTools();
  }

  private initializeTools(): void {
    // Weather Tool
    this.tools.set('weather', new Tool({
      name: 'weather',
      description: 'Get current weather information for a location',
      func: async (input: string) => {
        try {
          const location = input.trim();
          if (!location) return 'Please provide a location.';
          
          // ใช้ OpenWeatherMap API (ต้องมี API key)
          const apiKey = process.env.OPENWEATHER_API_KEY;
          if (!apiKey) {
            return 'Weather service not configured.';
          }
          
          const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`
          );
          
          const data = response.data;
          return `Weather in ${data.name}, ${data.sys.country}:
Temperature: ${data.main.temp}°C
Feels like: ${data.main.feels_like}°C
Humidity: ${data.main.humidity}%
Weather: ${data.weather[0].description}
Wind: ${data.wind.speed} m/s`;
        } catch (error) {
          return `Weather lookup failed: ${(error as Error).message}`;
        }
      },
    }));

    // Translation Tool
    this.tools.set('translate', new Tool({
      name: 'translate',
      description: 'Translate text between languages',
      func: async (input: string) => {
        try {
          // ใช้ Google Translate API (ต้องมี API key)
          const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
          if (!apiKey) {
            return 'Translation service not configured.';
          }
          
          // Parse input format: "text|source_lang|target_lang"
          const parts = input.split('|');
          if (parts.length !== 3) {
            return 'Please provide input in format: "text|source_lang|target_lang"';
          }
          
          const [text, sourceLang, targetLang] = parts;
          
          const response = await axios.post(
            `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
            {
              q: text,
              source: sourceLang,
              target: targetLang,
            }
          );
          
          const translation = response.data.data.translations[0].translatedText;
          return `Translation: ${translation}`;
        } catch (error) {
          return `Translation failed: ${(error as Error).message}`;
        }
      },
    }));

    // Currency Converter Tool
    this.tools.set('currency_converter', new Tool({
      name: 'currency_converter',
      description: 'Convert between different currencies',
      func: async (input: string) => {
        try {
          // Parse input format: "amount|from_currency|to_currency"
          const parts = input.split('|');
          if (parts.length !== 3) {
            return 'Please provide input in format: "amount|from_currency|to_currency"';
          }
          
          const [amount, fromCurrency, toCurrency] = parts;
          const numAmount = parseFloat(amount);
          
          if (isNaN(numAmount)) {
            return 'Invalid amount provided.';
          }
          
          // ใช้ Exchange Rate API
          const response = await axios.get(
            `https://api.exchangerate-api.com/v4/latest/${fromCurrency.toUpperCase()}`
          );
          
          const rates = response.data.rates;
          const toRate = rates[toCurrency.toUpperCase()];
          
          if (!toRate) {
            return `Currency ${toCurrency} not found.`;
          }
          
          const convertedAmount = numAmount * toRate;
          return `${numAmount} ${fromCurrency.toUpperCase()} = ${convertedAmount.toFixed(2)} ${toCurrency.toUpperCase()}`;
        } catch (error) {
          return `Currency conversion failed: ${(error as Error).message}`;
        }
      },
    }));

    // News Search Tool
    this.tools.set('news_search', new Tool({
      name: 'news_search',
      description: 'Search for recent news articles',
      func: async (input: string) => {
        try {
          const query = input.trim();
          if (!query) return 'Please provide a search query.';
          
          // ใช้ NewsAPI (ต้องมี API key)
          const apiKey = process.env.NEWS_API_KEY;
          if (!apiKey) {
            return 'News service not configured.';
          }
          
          const response = await axios.get(
            `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${apiKey}&pageSize=5&sortBy=publishedAt`
          );
          
          const articles = response.data.articles;
          if (!articles || articles.length === 0) {
            return 'No news articles found.';
          }
          
          const results = articles.map((article: any, index: number) => 
            `${index + 1}. ${article.title} (${article.source.name}) - ${article.publishedAt}`
          ).join('\n');
          
          return `Recent news about "${query}":\n${results}`;
        } catch (error) {
          return `News search failed: ${(error as Error).message}`;
        }
      },
    }));

    // Image Analysis Tool
    this.tools.set('image_analysis', new Tool({
      name: 'image_analysis',
      description: 'Analyze image content and extract information',
      func: async (input: string) => {
        try {
          // ใช้ AWS Rekognition หรือ Google Vision API
          // สำหรับตัวอย่างนี้จะ return mock response
          return 'Image analysis feature requires additional configuration with AWS Rekognition or Google Vision API.';
        } catch (error) {
          return `Image analysis failed: ${(error as Error).message}`;
        }
      },
    }));

    // Code Analysis Tool
    this.tools.set('code_analysis', new Tool({
      name: 'code_analysis',
      description: 'Analyze code for potential issues and improvements',
      func: async (input: string) => {
        try {
          const code = input.trim();
          if (!code) return 'Please provide code to analyze.';
          
          // Basic code analysis (สามารถขยายได้)
          const analysis = [];
          
          // Check for common issues
          if (code.includes('eval(')) {
            analysis.push('⚠️ Security: Avoid using eval() as it can execute arbitrary code');
          }
          
          if (code.includes('console.log(')) {
            analysis.push('ℹ️ Debug: Consider removing console.log statements in production');
          }
          
          if (code.includes('TODO') || code.includes('FIXME')) {
            analysis.push('📝 Note: Code contains TODO/FIXME comments');
          }
          
          // Basic complexity check
          const lines = code.split('\n').length;
          if (lines > 50) {
            analysis.push('📊 Complexity: Consider breaking down large functions');
          }
          
          if (analysis.length === 0) {
            analysis.push('✅ Code appears to follow good practices');
          }
          
          return `Code Analysis:\n${analysis.join('\n')}`;
        } catch (error) {
          return `Code analysis failed: ${(error as Error).message}`;
        }
      },
    }));

    // File Operations Tool
    this.tools.set('file_operations', new Tool({
      name: 'file_operations',
      description: 'Perform file operations (read, write, list)',
      func: async (input: string) => {
        try {
          // Parse input format: "operation|path|content(optional)"
          const parts = input.split('|');
          if (parts.length < 2) {
            return 'Please provide input in format: "operation|path|content(optional)"';
          }
          
          const [operation, path, content] = parts;
          
          // จำกัดการเข้าถึงเฉพาะ safe directories
          const safePath = this.validatePath(path);
          if (!safePath) {
            return 'Access denied: Invalid path.';
          }
          
          switch (operation.toLowerCase()) {
            case 'read':
              // Implementation for file reading
              return 'File read operation requires additional implementation.';
            case 'write':
              // Implementation for file writing
              return 'File write operation requires additional implementation.';
            case 'list':
              // Implementation for directory listing
              return 'File list operation requires additional implementation.';
            default:
              return 'Invalid operation. Supported: read, write, list';
          }
        } catch (error) {
          return `File operation failed: ${(error as Error).message}`;
        }
      },
    }));

    // Database Query Tool
    this.tools.set('database_query', new Tool({
      name: 'database_query',
      description: 'Query database for information',
      func: async (input: string) => {
        try {
          // จำกัดการเข้าถึงเฉพาะ read-only queries
          const query = input.trim().toLowerCase();
          
          if (query.includes('delete') || query.includes('drop') || query.includes('update')) {
            return 'Access denied: Write operations not allowed.';
          }
          
          // Implementation for database queries
          return 'Database query feature requires additional implementation.';
        } catch (error) {
          return `Database query failed: ${(error as Error).message}`;
        }
      },
    }));
  }

  private validatePath(path: string): string | null {
    // ตรวจสอบว่า path อยู่ใน safe directories
    const safeDirectories = ['/tmp', './uploads', './public'];
    const normalizedPath = path.replace(/\.\./g, ''); // ป้องกัน directory traversal
    
    for (const safeDir of safeDirectories) {
      if (normalizedPath.startsWith(safeDir)) {
        return normalizedPath;
      }
    }
    
    return null;
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  addCustomTool(name: string, description: string, func: (input: string) => Promise<string>): void {
    const tool = new Tool({
      name,
      description,
      func,
    });
    
    this.tools.set(name, tool);
  }

  removeTool(name: string): boolean {
    return this.tools.delete(name);
  }
}

// Export singleton instance
export const advancedToolService = new AdvancedToolService(); 