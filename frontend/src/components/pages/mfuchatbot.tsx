import React, { useState, useRef, useEffect } from 'react';
import { FaPaperPlane } from 'react-icons/fa';
import { BiLoaderAlt } from 'react-icons/bi';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  model?: string;
}

const MFUChatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedModel, setSelectedModel] = useState('llama2');
  const [isMobile, setIsMobile] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // เพิ่มฟังก์ชัน autoResize สำหรับปรับขนาด textarea
  const autoResize = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // รีเซ็ตความสูงก่อน เพื่อคำนวณความสูงที่ต้องการใหม่
      textarea.style.height = 'auto';
      
      // คำนวณจำนวนบรรทัด
      const lineHeight = 20; // ความสูงต่อบรรทัดโดยประมาณ
      const maxLines = 12;
      const maxHeight = lineHeight * maxLines;
      
      // กำหนดความสูงใหม่
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  };

  // เรียกใช้ autoResize เมื่อข้อความเปลี่ยน
  useEffect(() => {
    autoResize();
  }, [inputMessage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: inputMessage, model: selectedModel }),
      });

      const data = await response.json();
      
      const botMessage: Message = {
        id: messages.length + 2,
        text: data.response,
        sender: 'bot',
        timestamp: new Date(),
        model: data.model
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: messages.length + 2,
        text: 'Sorry, an error occurred. Please try again.',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (isMobile) {
        return;
      } else {
        if (!e.shiftKey) {
          e.preventDefault();
          handleSendMessage(e);
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="bg-blue-100 rounded-full p-4 mb-4">
              <svg className="w-8 h-8 text-blue-500" /* ... */ />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Welcome to MFU Chatbot</h2>
            <p className="text-gray-600">How can I help you today?</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
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
                  {message.sender === 'bot' && (
                    <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-100 rounded-full">
                        Using: {message.model || 'Unknown Model'}
                      </span>
                    </div>
                  )}
                  <p className="text-sm md:text-base whitespace-pre-wrap">{message.text}</p>
                  <span className="text-xs opacity-75 mt-1 block">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl p-4 rounded-tl-none max-w-[85%] md:max-w-[80%]">
                  <div className="flex items-center space-x-2">
                    <BiLoaderAlt className="w-5 h-5 animate-spin text-blue-500" />
                    <span className="text-sm text-gray-500">Typing...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:left-64 border-t p-4 bg-white z-10">
        <form onSubmit={handleSendMessage} className="max-w-screen-lg mx-auto">
          <div className="flex flex-col md:flex-row gap-2 md:gap-4">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 md:max-w-[200px] text-sm"
            >
              <option value="llama2">Llama 2</option>
              <option value="gpt">GPT-like</option>
            </select>
            <div className="flex gap-2 flex-1">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={isMobile 
                  ? "Type your message here... (Use send button to submit)" 
                  : "Type your message here... (Shift + Enter for new line)"
                }
                className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{
                  minHeight: '40px',
                  maxHeight: '240px', // 12 บรรทัด * 20px ต่อบรรทัด
                  overflowY: 'auto'
                }}
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading}
                className={`px-4 py-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${isLoading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
              >
                {isLoading ? (
                  <BiLoaderAlt className="w-5 h-5 animate-spin" />
                ) : (
                  <FaPaperPlane className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MFUChatbot;