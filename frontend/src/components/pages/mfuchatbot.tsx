import React, { useState, useRef, useEffect } from 'react';
import { FaPaperPlane } from 'react-icons/fa';
import { BiLoaderAlt } from 'react-icons/bi';
import axios from 'axios';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  model?: string;
  collection?: string;
}

const MFUChatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [collections] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [trainingFile, setTrainingFile] = useState<File | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const userGroups = userData.groups || [];
  const isStaff = userGroups.includes('Staffs');

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

  const autoResize = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const lineHeight = 20;
      const maxLines = 12;
      const maxHeight = lineHeight * maxLines;
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    autoResize();
  }, [inputMessage]);

  useEffect(() => {
    const loadModels = async () => {
      const response = await axios.get('/api/models');
      setModels(response.data);
    };
    loadModels();
  }, []);

  const handleTraining = async () => {
    if (!trainingFile || !selectedModel || !selectedCollection) return;
    
    setIsTraining(true);
    const formData = new FormData();
    formData.append('file', trainingFile);
    formData.append('model', selectedModel);
    formData.append('collection', selectedCollection);
    
    try {
      await axios.post('/api/train', formData);
      alert('Training completed successfully!');
    } catch (error) {
      console.error('Training error:', error);
      alert('Training failed!');
    } finally {
      setIsTraining(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
  };

  const handleSendMessage = async () => {
    setIsProcessing(true);
    setProcessingStatus('กำลังประมวลผล...');
    
    try {
      // ส่งคำถามไป API
      const response = await axios.post('/api/chat', {
        message: inputMessage,
        model: selectedModel
      });
      
      // อัพเดทข้อความ
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: response.data.response,
        sender: 'bot',
        timestamp: new Date()
      }]);
      
    } catch (error) {
      console.error('Chat error:', error);
      setProcessingStatus('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (isMobile) {
        return;
      } else {
        if (!e.shiftKey) {
          e.preventDefault();
          handleSendMessage();
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-4 p-4">
        <select 
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="border p-2"
        >
          <option value="">Select Model</option>
          {models.map(model => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>

        <select
          value={selectedCollection}
          onChange={(e) => setSelectedCollection(e.target.value)}
          className="border p-2"
        >
          <option value="">Select Collection</option>
          {collections.map(collection => (
            <option key={collection} value={collection}>{collection}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="bg-blue-100 rounded-full p-4 mb-4">
              <svg className="w-8 h-8 text-blue-500" /* ... */ />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Welcome to MFU Chat</h2>
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
                  <p className="text-sm md:text-base whitespace-pre-wrap">{message.text}</p>
                  <span className="text-xs opacity-75 mt-1 block">
                    {message.model} - {message.collection}
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
          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isMobile 
                ? "Type your message here... (Use send button to submit)" 
                : "Type your message here... (Shift + Enter for new line)"
              }
              className="flex-1 px-4 py-2 border focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{
                minHeight: '40px',
                maxHeight: '240px',
                overflowY: 'auto'
              }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading}
              className={`px-4 h-10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                ${isLoading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
            >
              {isLoading ? (
                <BiLoaderAlt className="w-5 h-5 animate-spin" />
              ) : (
                <FaPaperPlane className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      </div>

      {/* แสดงสถานะการทำงาน */}
      {isProcessing && (
        <div className="text-center py-2 text-gray-600">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2"></div>
          <p>{processingStatus}</p>
        </div>
      )}
    </div>
  );
};

export default MFUChatbot;