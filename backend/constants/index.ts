/**
 * Application constants
 */

// File upload limits
export const FILE_UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 1000 * 1024 * 1024, // 1GB
  MAX_FILE_SIZE_CHAT: 20 * 1024 * 1024, // 20MB for chat
  ALLOWED_FILE_TYPES: ['.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.json', '.xml'],
} as const;

// WebSocket configuration
export const WEBSOCKET_CONFIG = {
  PORT: 5001,
  PATH: '/ws',
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  CLIENT_TIMEOUT: 35000, // 35 seconds
} as const;

// Request timeout
export const REQUEST_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

// Body parser limits
export const BODY_PARSER_LIMIT = '1000mb';

// Session configuration
export const SESSION_CONFIG = {
  MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// JWT token expiration
export const JWT_EXPIRATION = {
  DEFAULT: '24h',
  SAML: '7d',
  GUEST: '1h',
} as const;

// Thailand timezone offset (UTC+7)
export const THAILAND_TIMEZONE_OFFSET_MS = 7 * 60 * 60 * 1000;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// Chat message limits
export const CHAT_LIMITS = {
  DEFAULT_MESSAGE_LIMIT: 6,
  LONG_MESSAGE_LIMIT: 2,
  MAX_CHAR_THRESHOLD: 500,
  MAX_QUERY_FOR_CONTEXT: 4000,
} as const;

// Collection query configuration
export const COLLECTION_CONFIG = {
  BATCH_SIZE: 3,
  MIN_SIMILARITY_THRESHOLD: 0.1,
  MIN_COLLECTION_SIMILARITY: 0.4,
  MAX_CONTEXT_LENGTH: 6000,
  MAX_RESULTS_PER_COLLECTION: 4,
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 1000,
  MAX_DELAY: 5000,
} as const;

// Default values
export const DEFAULTS = {
  CHAT_NAME: 'Untitled Chat',
  GUEST_USERNAME: 'guest',
  GUEST_EMAIL: 'guest@localhost',
  GUEST_FIRST_NAME: 'Guest',
  GUEST_LAST_NAME: 'User',
} as const;
