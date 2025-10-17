/**
 * Frontend Configuration for Microservices Architecture
 *
 * This configuration supports multiple microservices:
 * - auth-service: Authentication and authorization
 * - chat-service: Chat and WebSocket functionality
 * - agent-service: Agent management (future)
 * - rag-service: Knowledge base and RAG (future)
 */

const isDevelopment = import.meta.env.MODE === 'development';
const isProduction = import.meta.env.MODE === 'production';

// Base URLs for different environments
const BASE_URL = isDevelopment
  ? 'http://localhost:8080'
  : 'https://mfulearnai.mfu.ac.th';

const WS_BASE_URL = isDevelopment
  ? 'ws://localhost:8080'
  : 'wss://mfulearnai.mfu.ac.th';

/**
 * Microservices Configuration
 */
export const config = {
  // Environment
  isDevelopment,
  isProduction,

  // Legacy compatibility (for old code that uses config.apiUrl)
  apiUrl: BASE_URL,
  wsUrl: `${WS_BASE_URL}/ws/chat`,

  // Microservices URLs
  services: {
    auth: {
      baseUrl: BASE_URL,
      apiPath: '/api/auth',
      fullUrl: `${BASE_URL}/api/auth`,
    },
    chat: {
      baseUrl: BASE_URL,
      apiPath: '/api/chat',
      wsPath: '/ws/chat',
      fullUrl: `${BASE_URL}/api/chat`,
      wsUrl: `${WS_BASE_URL}/ws/chat`,
    },
    agent: {
      baseUrl: BASE_URL,
      apiPath: '/api/agents',
      fullUrl: `${BASE_URL}/api/agents`,
    },
    rag: {
      baseUrl: BASE_URL,
      apiPath: '/api/rag',
      fullUrl: `${BASE_URL}/api/rag`,
    },
  },

  // WebSocket configuration
  websocket: {
    reconnectInterval: 3000, // 3 seconds
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000, // 30 seconds
    connectionTimeout: 10000, // 10 seconds
  },

  // API configuration
  api: {
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
  },

  // Feature flags
  features: {
    enableStreaming: true,
    enableTools: true,
    enableMultiModal: true, // Images support
    enableVoice: false, // Future feature
  },
};

/**
 * Get service URL
 */
export function getServiceUrl(service: keyof typeof config.services): string {
  return config.services[service].fullUrl;
}

/**
 * Get WebSocket URL for a service
 */
export function getWebSocketUrl(service: keyof typeof config.services): string {
  const serviceConfig = config.services[service];
  if ('wsUrl' in serviceConfig) {
    return serviceConfig.wsUrl;
  }
  throw new Error(`Service ${service} does not support WebSocket`);
}

/**
 * Check if running in development mode
 */
export function isDev(): boolean {
  return config.isDevelopment;
}

/**
 * Check if running in production mode
 */
export function isProd(): boolean {
  return config.isProduction;
}

export default config; 