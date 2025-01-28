import React, { useState, useRef, useEffect } from 'react';
// import { FaPaperPlane } from 'react-icons/fa';
import { BiLoaderAlt } from 'react-icons/bi';
import { config } from '../../config/config';

interface Source {
  modelId: string;
  collectionName: string;
  filename: string;
  source?: string;
  similarity: number;
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
}

// เพิ่ม constant สำหรับ timeout
// const CHAT_TIMEOUT = 4.5 * 60 * 1000; // 4.5 นาที (น้อยกว่า server timeout)

const MFUChatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [, setLoadingModels] = useState(true);
  const [, setLoadingCollections] = useState(true);
  const [, setError] = useState<string | null>(null);

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
    fetchCollections();
  }, []);

  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const response = await fetch(`${config.apiUrl}/api/chat/history`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch chat history');
        }
        
        const history = await response.json();
        if (history.length > 0) {
          // แปลง timestamp และเพิ่ม sources ในแต่ละข้อความ
          const latestChat = history[0];
          const formattedMessages = latestChat.messages.map((msg: {
            timestamp: string | number | Date;
            sources?: string[];
            content: string;
            role: 'user' | 'assistant';
          }) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
            sources: msg.sources || [] // เพิ่ม sources หรือใช้ array ว่างถ้าไม่มี
          }));
          setMessages(formattedMessages);
          setSelectedModel(latestChat.modelId);
          setSelectedCollection(latestChat.collectionName);
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    };

    loadChatHistory();
  }, []);

  const fetchModels = async () => {
    try {
      setLoadingModels(true);
      const response = await fetch(`${config.apiUrl}/api/training/models`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }
      const data = await response.json();
      setModels(data);
      if (data.length === 1) {
        setSelectedModel(data[0]);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const fetchCollections = async () => {
    try {
      setLoadingCollections(true);
      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch collections');
      }
      const data = await response.json();
      setCollections(data);
      if (data.length === 1) {
        setSelectedCollection(data[0]);
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
    } finally {
      setLoadingCollections(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedModel || !selectedCollection || isLoading) return;

    const newMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          messages: [...messages, newMessage],
          modelId: selectedModel,
          collectionName: selectedCollection
        })
      });

      // เพิ่มการ log response status และ body
      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response body:', responseText);

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.status} ${responseText}`);
      }

      // แปลง response text กลับเป็น JSON
      const data = JSON.parse(responseText);
      
      if (!data.content || typeof data.content !== 'string') {
        throw new Error('Invalid response format');
      }

      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
        sources: data.sources
      }]);

    } catch (error) {
      console.error('Detailed error:', error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: `เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }]);
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
          handleSubmit(e);
        }
      }
    }
  };

  // const formatTimestamp = (timestamp: string | Date) => {
  //   if (!timestamp) return '';
  //   const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  //   return date.toLocaleTimeString();
  // };

  const clearChat = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/chat/clear`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to clear chat history');
      }

      setMessages([]); // เคลียร์ข้อความในหน้าจอ
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-[calc(180px+env(safe-area-inset-bottom))] pt-4 md:pb-40">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">💬</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">Welcome to MFU ChatAI</h2>
            <p className="text-gray-600">How can I help you today?</p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <div key={message.id}>
                <div 
                  className={`mb-2 max-w-[85%] md:max-w-[80%] ${
                    message.role === 'user' 
                      ? 'ml-auto bg-blue-500 text-white' 
                      : 'mr-auto bg-gray-100'
                  } rounded-lg p-3 md:p-4`}
                >
                  <div className={`text-xs md:text-sm ${
                    message.role === 'user' 
                      ? 'text-blue-100' 
                      : 'text-gray-500'
                  } mb-1`}>
                    {message.timestamp && new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="whitespace-pre-wrap text-sm md:text-base">{message.content}</div>
                </div>
                
                {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                  <div className="ml-2 mt-1">
                    <button
                      onClick={() => {
                        const sourceInfo = message.sources?.map(source => 
                          `Model: ${source.modelId}\n` +
                          `Collection: ${source.collectionName}\n` +
                          `File: ${source.filename}\n` +
                          `Source: ${source.source || 'N/A'}\n` +
                          `Similarity: ${(source.similarity * 100).toFixed(1)}%`
                        ).join('\n\n');
                        alert(sourceInfo);
                      }}
                      className="text-xs text-blue-500 hover:text-blue-700 underline flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      View Sources ({message.sources.length})
                    </button>
                  </div>
                )}
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

      {/* Fixed Bottom Container */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white border-t pb-[env(safe-area-inset-bottom)]">
        {/* Controls */}
        <div className="p-2 md:p-4 border-b">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="p-1 md:p-2 text-sm md:text-base border rounded flex-1 max-w-[150px] md:max-w-[200px]"
            >
              <option value="">Choose Model</option>
              {models.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="p-1 md:p-2 text-sm md:text-base border rounded flex-1 max-w-[150px] md:max-w-[200px]"
            >
              <option value="">Choose Collection</option>
              {collections.map(collection => (
                <option key={collection} value={collection}>{collection}</option>
              ))}
            </select>
            <button
              onClick={clearChat}
              className="px-3 py-1 md:px-4 md:py-2 text-sm md:text-base bg-red-500 text-white rounded hover:bg-red-600 transition-colors whitespace-nowrap"
            >
              Clear Chat
            </button>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-2 md:p-4">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <textarea
              value={inputMessage}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange(e)}
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => handleKeyDown(e)}
              className="flex-1 p-2 text-sm md:text-base border rounded resize-none"
              placeholder="Type your message here..."
              rows={1}
            />
            <button
              type="submit"
              className="px-3 py-1 md:px-4 md:py-2 text-sm md:text-base bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MFUChatbot;