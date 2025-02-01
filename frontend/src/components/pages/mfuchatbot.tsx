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
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {/* Update logo section */}
        <div className="flex flex-col items-center justify-center mb-8">
          <img 
            src="/mfu_logo_chatbot.PNG" 
            alt="MFU Logo" 
            className="w-24 h-24 mb-4 object-contain"
          />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Welcome to{' '}
            <span style={{ 
              background: 'linear-gradient(to right, rgb(186, 12, 47), rgb(212, 175, 55))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              MFU
            </span>{' '}
            <span>LEARN{' '}</span>
            <span style={{ 
              background: 'linear-gradient(to right, #00FFFF, #0099FF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              AI
            </span>
          </h1>
        </div>
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
                }}>MFU</span>{' '}
                Chat
                <span style={{ 
                  background: 'linear-gradient(to right, #00FFFF, #0099FF)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>AI</span>
              </span>
            </h2>
            <p className="text-gray-600 dark:text-gray-300">How can I help you today?</p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <div key={message.id}>
                <div className={`flex items-start gap-3 ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}>
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full overflow-hidden ${
                    message.role === 'user' ? 'bg-blue-500' : 'bg-transparent'
                  } flex items-center justify-center`}>
                    {message.role === 'user' ? (
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <img 
                        src="/dindin.PNG" 
                        alt="AI Assistant" 
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Message Content */}
                  <div className={`max-w-[75%] md:max-w-[70%] ${
                    message.role === 'user' 
                      ? 'ml-auto bg-blue-500 text-white' 
                      : 'mr-auto bg-gray-100 dark:bg-gray-700 dark:text-white'
                  } rounded-lg p-3 md:p-4`}>
                    <div className={`text-xs md:text-sm ${
                      message.role === 'user' 
                        ? 'text-blue-100' 
                        : 'text-gray-500'
                    } mb-1`}>
                      {message.timestamp && new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="whitespace-pre-wrap text-sm md:text-base">{message.content}</div>
                  </div>
                </div>
                
                {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                  <div className="ml-2 mt-1">
                    <button
                      onClick={() => {
                        const sourceInfo = message.sources?.map(source => 
                          `Model: ${source.modelId}\n` +
                          `Collection: ${source.collectionName}\n` +
                          `File: ${source.filename}\n` +
                          `