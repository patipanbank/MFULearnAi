export interface ImageData {
  url: string;
  mediaType: string;
}

export interface ResponsiveChatInputProps {
  message: string;
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  images: ImageData[];
  onRemoveImage: (index: number) => void;
  disabled?: boolean;
  isTyping?: boolean;
  hasMessages?: boolean;
  isInChatRoom?: boolean;
  onRoomCreated?: (roomId: string) => void;
}

export interface ChatTextAreaProps {
  message: string;
  onMessageChange: (message: string) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  isTyping?: boolean;
  currentMode: 'floating' | 'fixbottom';
}

export interface ImagePreviewProps {
  images: ImageData[];
  onRemoveImage: (index: number) => void;
}

export interface ActionButtonsProps {
  onSendMessage: () => void;
  onAttachClick: () => void;
  disabled?: boolean;
  isTyping?: boolean;
  hasContent: boolean;
  currentMode: 'floating' | 'fixbottom';
}

export interface ConnectionStatusProps {
  isInChatRoom: boolean;
  currentMode: 'floating' | 'fixbottom';
}