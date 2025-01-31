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

const modelNames: { [key: string]: string } = {
  'amazon.titan-text-express-v1': 'Titan',
  'anthropic.claude-v2': 'Claude',
  'anthropic.claude-3-5-sonnet-20240620-v1:0': 'Claude 3.5 Sonnet',
  'anthropic.claude-3-haiku-20240307-v1:0': 'Claude 3 Haiku'
};

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
  // const [, setLoadingCollections] = useState(true);

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
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          console.error('No auth token found');
          return;
        }

        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        const [modelsRes, collectionsRes] = await Promise.all([
          fetch(`${config.apiUrl}/api/training/models`, { headers }),
          fetch(`${config.apiUrl}/api/training/collections`, { headers })
        ]);

        if (!modelsRes.ok || !collectionsRes.ok) {
          throw new Error('Failed to fetch data');
        }
        
        const modelsData = await modelsRes.json();
        const collectionsData = await collectionsRes.json();
        
        // ตรวจสอบว่าข้อมูลเป็น array
        setModels(Array.isArray(modelsData) ? modelsData : []);
        setCollections(Array.isArray(collectionsData) ? collectionsData : []);
      } catch (error) {
        console.error('Error fetching data:', error);
        setModels([]);
        setCollections([]);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        const response = await fetch(`${config.apiUrl}/api/chat/history`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const history = await response.json();
          if (history.messages) {
            setMessages(history.messages);
            // ตั้งค่า model และ collection ที่เคยใช้
            setSelectedModel(history.modelId || '');
            setSelectedCollection(history.collectionName || '');
          }
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    };

    loadChatHistory();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading || !selectedModel || !selectedCollection) return;

    try {
      setIsLoading(true);
      
      const userMessage = {
        id: messages.length + 1,
        role: 'user' as const,
        content: inputMessage.trim(),
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');

      const response = await fetch(`${config.apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          modelId: selectedModel,
          collectionName: selectedCollection
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      const assistantMessage = {
        id: messages.length + 2,
        role: 'assistant' as const,
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // บันทึกประวัติแชท
      await fetch(`${config.apiUrl}/api/chat/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          messages: [...messages, userMessage, assistantMessage],
          modelId: selectedModel,
          collectionName: selectedCollection
        })
      });

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: messages.length + 2,
        role: 'assistant' as const,
        content: 'Sorry, there was an error during processing. Please try again.',
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
            <h2 className="text-center text-xl font-semibold mb-2 text-gray-800 dark:text-white">
              Welcome to
              <br />
              <span className="text-3xl">
                <span style={{ 
                  background: 'linear-gradient(to right, rgb(186, 12, 47), rgb(212, 175, 55))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>MFU</span> ChatAI
              </span>
            </h2>
            <p className="text-gray-600 dark:text-gray-300">How can I help you today?</p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <div key={message.id}>
                <div 
                  className={`mb-2 max-w-[85%] md:max-w-[80%] ${
                    message.role === 'user' 
                      ? 'ml-auto bg-blue-500 text-white' 
                      : 'mr-auto bg-gray-100 dark:bg-gray-700 dark:text-white'
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
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white dark:bg-gray-800 border-t dark:border-gray-700 pb-[env(safe-area-inset-bottom)]">
        {/* Controls */}
        <div className="p-2 md:p-4 border-b">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="p-1 md:p-2 text-sm md:text-base border rounded flex-1 max-w-[120px] md:max-w-[150px] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Select Model</option>
              {models.map(model => (
                <option key={model} value={model}>
                  {modelNames[model] || model}
                </option>
              ))}
            </select>
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="p-1 md:p-2 text-sm md:text-base border rounded flex-1 max-w-[150px] md:max-w-[200px] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
              className="flex-1 p-2 text-sm md:text-base border rounded resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Type your message here..."
              rows={1}
            />
            <button
              type="submit"
              className="px-3 py-1 md:px-4 md:py-2 text-sm md:text-base bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
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