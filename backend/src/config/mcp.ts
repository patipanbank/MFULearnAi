
import dotenv from 'dotenv';
dotenv.config();

export interface McpServerConfig {
    id: string;
    label: string;
    url?: string;
    enabled: boolean;
}

export const MCP_CONFIG = {
    CCTV: {
        id: 'cctv',
        label: 'CCTV Monitoring System',
        url: process.env.MCP_CCTV_URL,
        get enabled(): boolean {
            return !!process.env.MCP_CCTV_URL;
        }
    }
} as const;
