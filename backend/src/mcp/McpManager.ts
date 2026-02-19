import { CctvMcpTool } from './tools/CctvMcpTool';
import { LoggerService } from '../services/LoggerService';
import { AgentTool } from '../tools/AgentTool';

class McpManager {
    private cctvMcp: CctvMcpTool | null = null;
    private tools: AgentTool[] = [];
    private initialized = false;

    async init() {
        if (this.initialized) return;

        try {
            LoggerService.info('mcp_manager_init_start', { service: 'CCTV' });
            this.cctvMcp = new CctvMcpTool('system'); // Use 'system' level userId for manager
            const newTools = await this.cctvMcp.init();
            this.tools = newTools;
            this.initialized = true;
            LoggerService.info('mcp_manager_init_complete', { count: this.tools.length });
        } catch (error: any) {
            LoggerService.error('mcp_manager_init_error', { error: error.message });
        }
    }

    getTools(): AgentTool[] {
        return this.tools;
    }

    async refresh() {
        this.initialized = false;
        await this.init();
    }

    disconnect() {
        if (this.cctvMcp) {
            this.cctvMcp.disconnect();
            this.cctvMcp = null;
            this.tools = [];
            this.initialized = false;
        }
    }
}

export const mcpManager = new McpManager();
