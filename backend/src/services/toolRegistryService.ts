export interface Tool {
  name: string;
  description: string;
  execute: (input: any) => Promise<string>;
}

export class ToolRegistryService {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.initializeDefaultTools();
  }

  private initializeDefaultTools() {
    // Web search tool
    this.registerTool({
      name: 'web_search',
      description: 'Search the web for current information',
      execute: async (query: string) => {
        // TODO: Implement actual web search
        return `Search results for: ${query}\n\nThis is a placeholder for web search functionality.`;
      }
    });

    // Calculator tool
    this.registerTool({
      name: 'calculator',
      description: 'Perform mathematical calculations',
      execute: async (expression: string) => {
        try {
          // Basic calculator - in production, use a proper math library
          const result = eval(expression);
          return `Calculation result: ${expression} = ${result}`;
        } catch (error) {
          return `Error calculating ${expression}: ${error}`;
        }
      }
    });

    // Current date tool
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

  public registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  public getToolsForSession(sessionId: string): Tool[] {
    // For now, return all available tools
    // In the future, this could be session-specific
    return Array.from(this.tools.values());
  }

  public async executeTool(toolName: string, input: any): Promise<string> {
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    try {
      return await tool.execute(input);
    } catch (error) {
      throw new Error(`Error executing tool ${toolName}: ${error}`);
    }
  }

  public getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  public getToolDescriptions(): Record<string, string> {
    const descriptions: Record<string, string> = {};
    for (const [name, tool] of this.tools) {
      descriptions[name] = tool.description;
    }
    return descriptions;
  }
}

export const toolRegistryService = new ToolRegistryService(); 