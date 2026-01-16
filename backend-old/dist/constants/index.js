"use strict";
/**
 * Application constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULTS = exports.RETRY_CONFIG = exports.COLLECTION_CONFIG = exports.CHAT_LIMITS = exports.PAGINATION = exports.THAILAND_TIMEZONE_OFFSET_MS = exports.JWT_EXPIRATION = exports.SESSION_CONFIG = exports.BODY_PARSER_LIMIT = exports.REQUEST_TIMEOUT = exports.WEBSOCKET_CONFIG = exports.FILE_UPLOAD_LIMITS = void 0;
// File upload limits
exports.FILE_UPLOAD_LIMITS = {
    MAX_FILE_SIZE: 1000 * 1024 * 1024, // 1GB
    MAX_FILE_SIZE_CHAT: 20 * 1024 * 1024, // 20MB for chat
    ALLOWED_FILE_TYPES: ['.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.json', '.xml'],
};
// WebSocket configuration
exports.WEBSOCKET_CONFIG = {
    PORT: 5001,
    PATH: '/ws',
    HEARTBEAT_INTERVAL: 30000, // 30 seconds
    CLIENT_TIMEOUT: 35000, // 35 seconds
};
// Request timeout
exports.REQUEST_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
// Body parser limits
exports.BODY_PARSER_LIMIT = '1000mb';
// Session configuration
exports.SESSION_CONFIG = {
    MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
};
// JWT token expiration
exports.JWT_EXPIRATION = {
    DEFAULT: '24h',
    SAML: '7d',
    GUEST: '1h',
};
// Thailand timezone offset (UTC+7)
exports.THAILAND_TIMEZONE_OFFSET_MS = 7 * 60 * 60 * 1000;
// Pagination defaults
exports.PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
};
// Chat message limits
exports.CHAT_LIMITS = {
    DEFAULT_MESSAGE_LIMIT: 6,
    LONG_MESSAGE_LIMIT: 2,
    MAX_CHAR_THRESHOLD: 500,
    MAX_QUERY_FOR_CONTEXT: 4000,
};
// Collection query configuration
exports.COLLECTION_CONFIG = {
    BATCH_SIZE: 3,
    MIN_SIMILARITY_THRESHOLD: 0.1,
    MIN_COLLECTION_SIMILARITY: 0.4,
    MAX_CONTEXT_LENGTH: 6000,
    MAX_RESULTS_PER_COLLECTION: 4,
};
// Retry configuration
exports.RETRY_CONFIG = {
    MAX_RETRIES: 3,
    BASE_DELAY: 1000,
    MAX_DELAY: 5000,
};
// Default values
exports.DEFAULTS = {
    CHAT_NAME: 'Untitled Chat',
    GUEST_USERNAME: 'guest',
    GUEST_EMAIL: 'guest@localhost',
    GUEST_FIRST_NAME: 'Guest',
    GUEST_LAST_NAME: 'User',
};
