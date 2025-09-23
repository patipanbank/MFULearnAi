"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCode = exports.StreamingEventType = exports.WorkflowNodeType = exports.MessageStatus = exports.MessageRole = exports.ConversationStatus = void 0;
var ConversationStatus;
(function (ConversationStatus) {
    ConversationStatus["ACTIVE"] = "active";
    ConversationStatus["PAUSED"] = "paused";
    ConversationStatus["COMPLETED"] = "completed";
    ConversationStatus["ERROR"] = "error";
    ConversationStatus["ARCHIVED"] = "archived";
})(ConversationStatus || (exports.ConversationStatus = ConversationStatus = {}));
var MessageRole;
(function (MessageRole) {
    MessageRole["USER"] = "user";
    MessageRole["ASSISTANT"] = "assistant";
    MessageRole["SYSTEM"] = "system";
    MessageRole["TOOL"] = "tool";
})(MessageRole || (exports.MessageRole = MessageRole = {}));
var MessageStatus;
(function (MessageStatus) {
    MessageStatus["PENDING"] = "pending";
    MessageStatus["PROCESSING"] = "processing";
    MessageStatus["STREAMING"] = "streaming";
    MessageStatus["COMPLETED"] = "completed";
    MessageStatus["FAILED"] = "failed";
    MessageStatus["RETRYING"] = "retrying";
})(MessageStatus || (exports.MessageStatus = MessageStatus = {}));
var WorkflowNodeType;
(function (WorkflowNodeType) {
    WorkflowNodeType["MEMORY"] = "memory";
    WorkflowNodeType["TOOL"] = "tool";
    WorkflowNodeType["LLM"] = "llm";
    WorkflowNodeType["ROUTER"] = "router";
    WorkflowNodeType["AGGREGATOR"] = "aggregator";
})(WorkflowNodeType || (exports.WorkflowNodeType = WorkflowNodeType = {}));
var StreamingEventType;
(function (StreamingEventType) {
    StreamingEventType["CONVERSATION_STARTED"] = "conversation_started";
    StreamingEventType["CONVERSATION_ENDED"] = "conversation_ended";
    StreamingEventType["MESSAGE_STARTED"] = "message_started";
    StreamingEventType["MESSAGE_CHUNK"] = "message_chunk";
    StreamingEventType["MESSAGE_COMPLETED"] = "message_completed";
    StreamingEventType["MESSAGE_FAILED"] = "message_failed";
    StreamingEventType["TOOL_STARTED"] = "tool_started";
    StreamingEventType["TOOL_COMPLETED"] = "tool_completed";
    StreamingEventType["TOOL_FAILED"] = "tool_failed";
    StreamingEventType["WORKFLOW_STEP"] = "workflow_step";
    StreamingEventType["WORKFLOW_ERROR"] = "workflow_error";
    StreamingEventType["CONNECTION_STATUS"] = "connection_status";
    StreamingEventType["ERROR"] = "error";
    StreamingEventType["HEARTBEAT"] = "heartbeat";
})(StreamingEventType || (exports.StreamingEventType = StreamingEventType = {}));
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["CONNECTION_FAILED"] = "CONNECTION_FAILED";
    ErrorCode["CONNECTION_TIMEOUT"] = "CONNECTION_TIMEOUT";
    ErrorCode["WEBSOCKET_ERROR"] = "WEBSOCKET_ERROR";
    ErrorCode["AUTH_FAILED"] = "AUTH_FAILED";
    ErrorCode["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    ErrorCode["PERMISSION_DENIED"] = "PERMISSION_DENIED";
    ErrorCode["INVALID_INPUT"] = "INVALID_INPUT";
    ErrorCode["MISSING_REQUIRED_FIELD"] = "MISSING_REQUIRED_FIELD";
    ErrorCode["INVALID_FORMAT"] = "INVALID_FORMAT";
    ErrorCode["LLM_ERROR"] = "LLM_ERROR";
    ErrorCode["TOOL_ERROR"] = "TOOL_ERROR";
    ErrorCode["MEMORY_ERROR"] = "MEMORY_ERROR";
    ErrorCode["WORKFLOW_ERROR"] = "WORKFLOW_ERROR";
    ErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorCode["STORAGE_ERROR"] = "STORAGE_ERROR";
    ErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
//# sourceMappingURL=types.js.map