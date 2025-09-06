export interface UseWebSocketOptions {
  chatId?: string;
  isInChatRoom: boolean;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
}

export interface PendingMessage {
  type: string;
  text?: string;
  images?: Array<{ url: string; mediaType: string }>;
  chatId?: string;
  agent_id?: string;
}

export interface PendingFirstMessage {
  text: string;
  images: Array<{ url: string; mediaType: string }>;
  agentId?: string;
}

export interface WebSocketEventHandlers {
  onChunk?: (data: any) => void;
  onError?: (error: string) => void;
  onAccepted?: (data: any) => void;
  onRoomJoined?: (data: any) => void;
  onRoomCreated?: (data: any) => void;
  onToolStart?: (data: any) => void;
  onToolResult?: (data: any) => void;
  onToolError?: (data: any) => void;
  onAssistantCreated?: (data: any) => void;
  onEnd?: (data: any) => void;
  onUploadProgress?: (data: any) => void;
}