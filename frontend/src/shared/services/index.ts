// Export all services and their utilities
export * from './agentService';
export * from './chatService';
export * from './knowledgeService';

// Export service instances for direct usage
export { agentManager, toolRegistry } from './agentService';
export { conversationOrchestrator } from './chatService';
export { knowledgeEngine, documentProcessor } from './knowledgeService';