import React from 'react';
import { MessageOutlined } from '@ant-design/icons';

interface ChatHistoryProps {
  histories: {
    id: string;
    title: string;
    timestamp: string;
  }[];
  onSelectChat: (chatId: string) => void;
  currentChatId: string | null;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ histories, onSelectChat, currentChatId }) => {
  return (
    <div className="mt-4">
      <div className="text-sm text-gray-500 px-4 mb-2">Chat History</div>
      <div className="space-y-1">
        {histories.map((chat) => (
          <button
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 ${
              currentChatId === chat.id ? 'bg-gray-100' : ''
            }`}
          >
            <MessageOutlined />
            <div className="flex-1 truncate">
              <div className="text-sm">{chat.title}</div>
              <div className="text-xs text-gray-500">
                {new Date(chat.timestamp).toLocaleDateString('th-TH')}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChatHistory; 