import type { LLM } from '../llmFactory';
import type { ToolFunction } from '../tools/ToolRegistry';
import { AgentExecutor } from './AgentExecutor';
import { AgentCache } from './AgentCache';
import type { AgentConfig, AgentCacheKey } from './types/agent.types';

/**
 * AgentFactory - สร้างและจัดการ Agent instances
 * - Factory pattern สำหรับสร้าง agents
 * - Caching mechanism สำหรับประสิทธิภาพ
 * - Configuration management
 */
export class AgentFactory {
  private cache: AgentCache;

  constructor() {
    this.cache = new AgentCache();
    console.log('✅ Agent factory initialized');
  }

  /**
   * สร้าง Agent instance พร้อม caching
   */
  public async createAgent(
    llm: LLM,
    tools: { [name: string]: ToolFunction },
    prompt: string,
    config?: AgentConfig
  ): Promise<AgentExecutor> {
    const agentConfig: Required<AgentConfig> = {
      modelId: config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      sessionId: config?.sessionId || 'default',
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 4000,
      systemPrompt: prompt,
      toolNames: Object.keys(tools).sort()
    };

    // สร้าง cache key
    const cacheKey: AgentCacheKey = {
      modelId: agentConfig.modelId,
      systemPrompt: agentConfig.systemPrompt,
      toolNames: agentConfig.toolNames,
      temperature: agentConfig.temperature,
      maxTokens: agentConfig.maxTokens
    };

    // ตรวจสอบ cache
    const cached = this.cache.get(agentConfig.sessionId, cacheKey);
    if (cached) {
      console.log(`⚡ Reusing cached agent for session ${agentConfig.sessionId}`);
      return cached;
    }

    // สร้าง Agent ใหม่
    console.log(`🤖 Creating new agent for session ${agentConfig.sessionId}`);
    const executor = new AgentExecutor(llm, tools, agentConfig);
    await executor.initialize();

    // Cache agent
    this.cache.set(agentConfig.sessionId, cacheKey, executor);

    return executor;
  }

  /**
   * ล้าง cache สำหรับ session
   */
  public clearSessionCache(sessionId: string): void {
    this.cache.clearSession(sessionId);
  }

  /**
   * ล้าง cache ทั้งหมด
   */
  public clearAllCache(): void {
    this.cache.clearAll();
  }

  /**
   * ดู cache statistics
   */
  public getCacheStats() {
    return this.cache.getStats();
  }
}

// Singleton instance
export const agentFactory = new AgentFactory();