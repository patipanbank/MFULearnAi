/**
 * Agent Service
 * Handles agent configuration and management
 */

import { api } from '../../shared/lib/api';
import { config } from '../../config/config';
import type { AgentConfig } from './types';

export class AgentService {
  private static get baseUrl(): string {
    return config.services.agent.apiPath;
  }

  /**
   * Get all agents accessible to current user
   */
  static async getAgents(): Promise<AgentConfig[]> {
    const response = await api.get<any>(this.baseUrl);

    // Handle different response formats (array or { data: array })
    let agents: any[] = [];
    if (Array.isArray(response)) {
      agents = response;
    } else if (response && Array.isArray(response.data)) {
      agents = response.data;
    }

    // Normalize permission field for backward compatibility
    return agents.map(agent => ({
      ...agent,
      permission: agent.permission || (agent.isPublic ? 'PUBLIC' : 'PRIVATE'),
      isPublic: agent.isPublic !== undefined ? agent.isPublic : agent.permission === 'PUBLIC'
    }));
  }

  /**
   * Get a specific agent by ID
   */
  static async getAgent(agentId: string): Promise<AgentConfig> {
    const agent = await api.get<any>(`${this.baseUrl}/${agentId}`);

    // Normalize permission field
    return {
      ...agent,
      permission: agent.permission || (agent.isPublic ? 'PUBLIC' : 'PRIVATE'),
      isPublic: agent.isPublic !== undefined ? agent.isPublic : agent.permission === 'PUBLIC'
    };
  }

  /**
   * Create a new agent
   */
  static async createAgent(
    agentConfig: Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'rating'>
  ): Promise<AgentConfig> {
    // Convert permission to isPublic for backend compatibility
    const backendConfig = {
      ...agentConfig,
      isPublic: agentConfig.permission === 'PUBLIC',
      permission: agentConfig.permission
    };

    const agent = await api.post<any>(this.baseUrl, backendConfig);

    // Normalize response
    return {
      ...agent,
      permission: agent.permission || (agent.isPublic ? 'PUBLIC' : 'PRIVATE'),
      isPublic: agent.isPublic !== undefined ? agent.isPublic : agent.permission === 'PUBLIC'
    };
  }

  /**
   * Update an agent
   */
  static async updateAgent(
    agentId: string,
    updates: Partial<AgentConfig>
  ): Promise<AgentConfig> {
    // Convert permission to isPublic for backend compatibility
    const backendUpdates = {
      ...updates,
      ...(updates.permission && {
        isPublic: updates.permission === 'PUBLIC',
        permission: updates.permission
      })
    };

    const agent = await api.put<any>(`${this.baseUrl}/${agentId}`, backendUpdates);

    // Normalize response
    return {
      ...agent,
      permission: agent.permission || (agent.isPublic ? 'PUBLIC' : 'PRIVATE'),
      isPublic: agent.isPublic !== undefined ? agent.isPublic : agent.permission === 'PUBLIC'
    };
  }

  /**
   * Delete an agent
   */
  static async deleteAgent(agentId: string): Promise<void> {
    return api.delete(`${this.baseUrl}/${agentId}`);
  }
}
