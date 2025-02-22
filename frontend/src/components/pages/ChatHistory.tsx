import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { config } from '../../config/config';

interface ChatHistoryItem {
  _id: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp: string;
  }>;
  modelId: string;
  collectionName: string;
  createdAt: string;
}

const ChatHistory: React.FC = () => {
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchChatHistory();
  }, []);

  const fetchChatHistory = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setHistory(Array.isArray(data) ? data : [data]);
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleChatClick = (chatId: string) => {
    navigate(`/mfuchatbot?chatId=${chatId}`);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">ประวัติการสนทนา</h1>
      <div className="space-y-4">
        {history.map((chat) => (
          <div
            key={chat._id}
            onClick={() => handleChatClick(chat._id)}
            className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="font-medium dark:text-white">
                {chat.messages[0]?.content.substring(0, 100)}...
              </div>
              <div className="text-sm text-gray-500">
                {formatDate(chat.createdAt)}
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Model: {chat.modelId} | Collection: {chat.collectionName}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatHistory; 