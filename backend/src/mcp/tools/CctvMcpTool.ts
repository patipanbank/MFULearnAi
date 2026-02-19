
import { MCPClient } from '../MCPClient';
import { McpToolAdapter } from '../McpToolAdapter';
import { MCP_CONFIG } from '../../config/mcp';
import { LoggerService } from '../../services/LoggerService';

export class CctvMcpTool {
    private client: MCPClient | null = null;
    public adapterTools: McpToolAdapter[] = [];

    constructor(private userId?: string) { }

    async init() {
        if (!MCP_CONFIG.CCTV.enabled || !MCP_CONFIG.CCTV.url) {
            LoggerService.warn('mcp_cctv_skipped', { reason: 'Disabled or No URL' }, this.userId);
            return [];
        }

        try {
            this.client = new MCPClient(MCP_CONFIG.CCTV.url);
            await this.client.connect();
            const tools = await this.client.listTools();

            this.adapterTools = tools.map((t: any) => new McpToolAdapter(this.client!, t));

            LoggerService.info('mcp_cctv_connected', {
                count: this.adapterTools.length,
                url: MCP_CONFIG.CCTV.url
            }, this.userId);

            return this.adapterTools;

        } catch (error: any) {
            LoggerService.error('mcp_cctv_error', { error: error.message }, this.userId);
            return [];
        }
    }

    disconnect() {
        if (this.client) {
            this.client.disconnect();
            this.client = null;
        }
    }
}
