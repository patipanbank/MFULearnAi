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
}

interface AIModel {
  _id: string;
  displayName: string;
  description: string;
  modelType: string;
}

interface KnowledgeBase {
  _id: string;
  displayName: string;
  description: string;
  baseModelId: string;
}

const MFUChatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedKB, setSelectedKB] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  const [models, setModels] = useState<AIModel[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);

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
    fetchModels();
  }, []);

  useEffect(() => {
    if (selectedModel) {
      fetchKnowledgeBases(selectedModel);
    }
  }, [selectedModel]);

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
      // Get auth_token from localStorage
      const authToken = localStorage.getItem('auth_token');
      
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/chat`, 
        { 
          message: inputMessage, 
          knowledgeBaseId: selectedKB 
        },
        { 
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.data;
      
      const botMessage: Message = {
        id: messages.length + 2,
        text: data.response,
        sender: 'bot',
        timestamp: new Date(),
        model: data.model
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
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

  // const modelDescriptions: Record<string, string> = {
  //   llama2: 'General purpose AI model',
  //   gpt2: 'GPT-like model for chat',
  //   t5: 'Math and reasoning focused'
  // };

  const fetchModels = async () => {
    try {
      const response = await axios.get('/api/models');
      setModels(response.data);
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  const fetchKnowledgeBases = async (modelId: string) => {
    try {
      const response = await axios.get(`/api/knowledge-base/by-model/${modelId}`);
      setKnowledgeBases(response.data);
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 space-y-2">
        <select
          value={selectedModel}
          onChange={(e) => {
            setSelectedModel(e.target.value);
            setSelectedKB('');
          }}
          className="w-full p-2 border rounded"
        >
          <option value="">Select a model</option>
          {models.map(model => (
            <option key={model._id} value={model._id}>
              {model.displayName}
            </option>
          ))}
        </select>

        {selectedModel && (
          <select
            value={selectedKB}
            onChange={(e) => setSelectedKB(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Select a knowledge base</option>
            {knowledgeBases.map(kb => (
              <option key={kb._id} value={kb._id}>
                {kb.displayName} - {kb.description}
              </option>
            ))}
          </select>
        )}
      </div>

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
                          Using: {
                            message.model === 'gpt2' ? 'GPT-like' :
                            message.model === 't5' ? 'Flan-T5' :
                            message.model === 'llama2' ? 'Llama 2' :
                            message.model || 'Unknown Model'
                          }
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MFUChatbot;