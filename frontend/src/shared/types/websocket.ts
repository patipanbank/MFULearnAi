/**
 * WebSocket Message Types
 * Shared types between frontend and backend for type safety
 */

export interface ImagePayload {
  url: string;
  mediaType: string;
}

export interface ToolUsage {
  type: 'tool_start' | 'tool_result' | 'tool_error';
  tool_name: string;
  tool_input?: string;
  output?: string;
  error?: string;
  timestamp: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date | string;
  images?: ImagePayload[];
  isStreaming?: boolean;
  isComplete?: boolean;
  toolUsage?: ToolUsage[];
  metadata?: Record<string, any>;
}

/**
 * Client -> Server Messages
 */

export interface CreateRoomMessage {
  type: 'create_room';
  agent_id: string;
}

export interface JoinRoomMessage {
  type: 'join_room';
  chatId: string;
}

export interface SendMessageMessage {
  type: 'message';
  text: string;
  chatId: string;
  agent_id?: string;
  images?: ImagePayload[];
}

export interface StopGenerationMessage {
  type: 'stop_generation';
  data: {
    sessionId: string;
  };
}

export interface PingMessage {
  type: 'ping';
}

export type ClientMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | SendMessageMessage
  | StopGenerationMessage
  | PingMessage;

/**
 * Server -> Client Messages
 */

export interface ConnectionEstablishedMessage {
  type: 'connection_established';
  data: {
    sessionId: string;
    userId: string;
  };
}

export interface RoomCreatedMessage {
  type: 'room_created';
  data: {
    chatId: string;
    agentId: string;
  };
}

export interface RoomJoinedMessage {
  type: 'room_joined';
  data: {
    chatId: string;
  };
}

export interface AcceptedMessage {
  type: 'accepted';
  data: {
    chatId: string;
  };
}

export interface MessageAddedMessage {
  type: 'message_added';
  data: {
    message: ChatMessage;
  };
}

export interface MessageUpdatedMessage {
  type: 'message_updated';
  data: {
    messageId: string;
    content: string;
    isStreaming?: boolean;
  };
}

export interface MessageCompletedMessage {
  type: 'message_completed';
  data: {
    messageId: string;
    content: string;
  };
}

export interface MessageErrorMessage {
  type: 'message_error';
  data: {
    messageId: string;
    chatId: string;
    error: string;
  };
}

export interface ToolStartMessage {
  type: 'tool_start';
  data: {
    tool_name: string;
    tool_input: string | Record<string, any>;
  };
}

export interface ToolResultMessage {
  type: 'tool_result';
  data: {
    tool_name: string;
    output: string;
  };
}

export interface ToolErrorMessage {
  type: 'tool_error';
  data: {
    tool_name: string;
    error: string;
  };
}

export interface ErrorMessage {
  type: 'error';
  data: {
    error: string;
    details?: string;
  };
}

export interface ImageProcessingErrorMessage {
  type: 'image_processing_error';
  data: {
    message: string;
  };
}

export interface QuotaExceededMessage {
  type: 'quota_exceeded';
  data: {
    reason: string;
  };
}

export interface PongMessage {
  type: 'pong';
  data: Record<string, never>;
}

export interface GenerationStoppedMessage {
  type: 'generation_stopped';
  data: {
    messageId: string;
    sessionId: string;
  };
}

export type ServerMessage =
  | ConnectionEstablishedMessage
  | RoomCreatedMessage
  | RoomJoinedMessage
  | AcceptedMessage
  | MessageAddedMessage
  | MessageUpdatedMessage
  | MessageCompletedMessage
  | MessageErrorMessage
  | ToolStartMessage
  | ToolResultMessage
  | ToolErrorMessage
  | ErrorMessage
  | ImageProcessingErrorMessage
  | QuotaExceededMessage
  | PongMessage
  | GenerationStoppedMessage;

/**
 * Type guards
 */

export function isServerMessage(message: any): message is ServerMessage {
  return message && typeof message.type === 'string';
}

export function isErrorMessage(message: ServerMessage): message is ErrorMessage {
  return message.type === 'error';
}

export function isMessageAddedMessage(message: ServerMessage): message is MessageAddedMessage {
  return message.type === 'message_added';
}

export function isMessageUpdatedMessage(message: ServerMessage): message is MessageUpdatedMessage {
  return message.type === 'message_updated';
}

export function isMessageCompletedMessage(message: ServerMessage): message is MessageCompletedMessage {
  return message.type === 'message_completed';
}

export function isRoomCreatedMessage(message: ServerMessage): message is RoomCreatedMessage {
  return message.type === 'room_created';
}

export function isRoomJoinedMessage(message: ServerMessage): message is RoomJoinedMessage {
  return message.type === 'room_joined';
}
