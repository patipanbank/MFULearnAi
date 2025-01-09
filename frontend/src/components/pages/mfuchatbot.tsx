import React, { useState } from 'react';
import { FaPaperPlane } from 'react-icons/fa';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const MFUChatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    setTimeout(() => {
      const botMessage: Message = {
        id: Date.now(),
        text: 'ขอบคุณสำหรับข้อความ ฉันจะช่วยตอบคำถามของคุณ',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    }, 1000);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-white">
      {/* Chat Header */}
      <div className="p-3 md:p-4 border-b bg-white">
        <h2 className="text-lg md:text-xl font-semibold text-gray-800 text-center">MFU Chatbot Assistant</h2>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 p-4">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-blue-100 flex items-center justify-center">
              <FaPaperPlane className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-700 text-center">
              Welcome to MFU Chatbot
            </h2>
            <p className="text-sm md:text-base text-gray-500 text-center max-w-sm">
              How can I help you today?
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[80%] rounded-2xl p-3 md:p-4 ${
                  message.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-gray-100 text-gray-800 rounded-tl-none'
                }`}
              >
                <p className="text-sm md:text-base">{message.text}</p>
                <span className="text-xs opacity-75 mt-1 block">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Chat Input */}
      <div className="border-t p-3 md:p-4 bg-white">
        <form onSubmit={handleSendMessage} className="flex space-x-2 md:space-x-4">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message here..."
            className="flex-1 px-3 md:px-4 py-2 md:py-3 border rounded-full text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
          />
          <button
            type="submit"
            className="px-4 md:px-6 py-2 md:py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
          >
            <FaPaperPlane className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default MFUChatbot;
