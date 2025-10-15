import axios, { AxiosInstance } from 'axios';
import config from '../config/config';
import logger from '../utils/logger';

/**
 * Agent Service Client
 * HTTP client for communicating with the agent-service
 */
export class AgentClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.AGENT_SERVICE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('📤 Agent service request', {
          method: config.method,
          url: config.url,
        });
        return config;
      },
      (error) => {
        logger.error('❌ Agent service request error', {
          error: error.message,
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('📥 Agent service response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('❌ Agent service response error', {
          status: error.response?.status,
          url: error.config?.url,
          error: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get agent configuration
   */
  async getAgent(agentId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/agents/${agentId}`);
      return response.data;
    } catch (error: any) {
      logger.error('❌ Error getting agent', {
        agentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * List available agents
   */
  async listAgents(): Promise<any[]> {
    try {
      const response = await this.client.get('/api/agents');
      return response.data;
    } catch (error: any) {
      logger.error('❌ Error listing agents', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get agent tools
   */
  async getAgentTools(agentId: string): Promise<string[]> {
    try {
      const response = await this.client.get(`/api/agents/${agentId}/tools`);
      return response.data.tools || [];
    } catch (error: any) {
      logger.error('❌ Error getting agent tools', {
        agentId,
        error: error.message,
      });
      // Return default tools if agent service is unavailable
      return ['search_memory', 'rag_retrieval', 'calculator'];
    }
  }

  /**
   * Get agent system prompt
   */
  async getAgentPrompt(agentId: string): Promise<string> {
    try {
      const response = await this.client.get(`/api/agents/${agentId}/prompt`);
      return response.data.prompt || '';
    } catch (error: any) {
      logger.error('❌ Error getting agent prompt', {
        agentId,
        error: error.message,
      });
      // Return default prompt if agent service is unavailable
      return 'You are a helpful AI assistant.';
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const agentClient = new AgentClient();
