import React, { useState, useRef, useEffect } from 'react';
import { BiLoaderAlt } from 'react-icons/bi';
import { GrSend } from "react-icons/gr";
import { config } from '../../config/config';
import { RiImageAddFill } from 'react-icons/ri';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Source {
  modelId: string;
  collectionName: string;
  filename: string;
  source?: string;
  similarity: number;
}

interface Message {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  image?: {
    data: string;
    mediaType: string;
  };
  images?: {
    data: string;
    mediaType: string;
  }[];
  sources?: Source[];
  isImageGeneration?: boolean;
}

interface Model {
  id: string;
  name: string;
  modelType: 'official' | 'personal' | 'staff_only';
}

// const modelNames: { [key: string]: string } = {
//   'anthropic.claude-3-5-sonnet-20240620-v1:0': 'Claude 3.5 Sonnet',
// };

const LoadingDots = () => (
  <div className="flex items-center space-x-1">
    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
  </div>
);

const MFUChatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImageGenerationMode, setIsImageGenerationMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // Add click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
      const lineHeight = 24;
      const maxLines = 5;
      const maxHeight = lineHeight * maxLines;
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    autoResize();
  }, [inputMessage]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          console.error('No auth token found');
          return;
        }

        // Validate token format
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
          console.error('Invalid token format');
          return;
        }

        // Get user role from token
        let tokenPayload;
        try {
          tokenPayload = JSON.parse(atob(tokenParts[1]));
        } catch (e) {
          console.error('Failed to parse token payload:', e);
          return;
        }
        const isStaff = tokenPayload.role === 'STAFF' || tokenPayload.role === 'ADMIN';

        console.log('Fetching models with token:', `Bearer ${token}`);
        // Fetch official and staff-only models from the database
        const response = await fetch(`${config.apiUrl}/api/models`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to fetch models:', response.status, errorText);
          
          if (response.status === 401) {
            // Token might be expired or invalid
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
            return;
          }
          
          throw new Error(`Failed to fetch models: ${errorText}`);
        }

        const dbModels = await response.json();
        
        // Filter models based on user role
        const filteredDbModels = dbModels.filter((model: any) => 
          model.modelType === 'official' || 
          (model.modelType === 'staff_only' && isStaff)
        );
        
        // Get personal models from localStorage
        const storedPersonalModels = JSON.parse(localStorage.getItem('personalModels') || '[]');

        // Combine both types of models
        const allModels = [
          ...filteredDbModels.map((model: any) => ({
            id: model._id,
            name: model.name,
            modelType: model.modelType
          })),
          ...storedPersonalModels.map((model: any) => ({
            id: model.id,
            name: model.name,
            modelType: 'personal'
          }))
        ];

        setModels(allModels);

        // Set the first model as selected if available
        if (allModels.length > 0) {
          setSelectedModel(allModels[0].id);
        }
      } catch (error) {
        console.error('Error fetching models:', error);
        if (error instanceof Error) {
          alert(error.message);
        }
        setModels([]);
      }
    };

    fetchModels();
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
            setSelectedModel(history.modelId || '');
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

  const compressImage = async (file: File): Promise<{ data: string; mediaType: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          resolve({
            data: compressedBase64.split(',')[1],
            mediaType: 'image/jpeg'
          });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit()) return;

    setIsLoading(true);
    const aiMessageId = messages.length + 2;

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log('Creating new WebSocket connection...');
        const wsUrl = new URL(import.meta.env.VITE_WS_URL);
        wsUrl.searchParams.append('token', token);
        wsRef.current = new WebSocket(wsUrl.toString());

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (wsRef.current) {
              wsRef.current.close();
            }
            reject(new Error('WebSocket connection timeout'));
          }, 10000);

          if (wsRef.current) {
            wsRef.current.onopen = () => {
              console.log('WebSocket connection established');
              clearTimeout(timeout);
              resolve(undefined);
            };

            wsRef.current.onerror = (error) => {
              console.error('WebSocket connection error:', error);
              clearTimeout(timeout);
              reject(new Error('Failed to establish WebSocket connection. Please check your internet connection and try again.'));
            };

            wsRef.current.onclose = (event) => {
              console.log('WebSocket connection closed:', event.code, event.reason);
              if (!event.wasClean) {
                reject(new Error(`WebSocket connection closed unexpectedly: ${event.reason || 'Unknown reason'}`));
              }
            };
          }
        });
      }

      const userMessage = {
        id: messages.length + 1,
        role: 'user' as const,
        content: inputMessage.trim(),
        timestamp: new Date(),
        images: selectedImages.length > 0 ? await Promise.all(
          selectedImages.map(async (file) => await compressImage(file))
        ) : undefined,
        isImageGeneration: isImageGenerationMode
      };

      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');
      setSelectedImages([]);

      setMessages(prev => [...prev, {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }]);

      let accumulatedContent = '';
      if (wsRef.current) {
        wsRef.current.onmessage = (event) => {
          try {
            console.log('Received WebSocket message:', event.data);
            const data = JSON.parse(event.data);
            
            if (data.error) {
              console.error('WebSocket error:', data.error);
              setMessages(prev => prev.map(msg =>
                msg.id === aiMessageId
                  ? { ...msg, content: `Error: ${data.error}` }
                  : msg
              ));
              return;
            }

            if (data.content) {
              accumulatedContent += data.content;
              setMessages(prev => prev.map(msg =>
                msg.id === aiMessageId
                  ? { 
                      ...msg, 
                      content: accumulatedContent,
                      images: data.generatedImage ? [{
                        data: data.generatedImage,
                        mediaType: 'image/png'
                      }] : undefined
                    }
                  : msg
              ));
            }

            if (data.done) {
              const updatedMessages = [
                ...messages,
                userMessage,
                {
                  id: aiMessageId,
                  role: 'assistant' as const,
                  content: accumulatedContent,
                  timestamp: new Date(),
                  sources: data.sources,
                  images: data.generatedImage ? [{
                    data: data.generatedImage,
                    mediaType: 'image/png'
                  }] : undefined
                }
              ];

              saveChatHistory(updatedMessages);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            setMessages(prev => prev.map(msg =>
              msg.id === aiMessageId
                ? { ...msg, content: 'Error: Failed to parse response' }
                : msg
            ));
          }
        };

        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setMessages(prev => prev.map(msg =>
            msg.id === aiMessageId
              ? { ...msg, content: 'Error: WebSocket connection failed' }
              : msg
          ));
        };

        console.log('Sending message to WebSocket:', {
          messages: [...messages, userMessage],
          modelId: selectedModel,
          isImageGeneration: isImageGenerationMode
        });

        wsRef.current.send(JSON.stringify({
          messages: [...messages, userMessage],
          modelId: selectedModel,
          isImageGeneration: isImageGenerationMode
        }));
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setMessages(prev => [...prev, {
        id: aiMessageId,
        role: 'assistant',
        content: error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const saveChatHistory = async (messages: Message[]) => {
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${config.apiUrl}/api/chat/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          messages,
          modelId: selectedModel
        })
      });
    } catch (error) {
      console.error('Error saving chat history:', error);
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

      setMessages([]);
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };
  
  const validateImageFile = (file: File): boolean => {
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Image size must not exceed 20MB');
      return false;
    }
    return true;
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;

    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file && validateImageFile(file)) {
            setSelectedImages(prev => [...prev, file]);
          }
          break;
        }
      }
    }
  };

  const canSubmit = () => {
    return (
      !isLoading &&
      selectedModel &&
      inputMessage.trim()
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setSelectedImages(prev => [...prev, ...Array.from(files)]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const MessageContent: React.FC<{ message: Message }> = ({ message }) => {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const copyToClipboard = (code: string, index: number) => {
      navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    };

    const renderContent = (content: string) => {
      const parts = content.split(/(```[\s\S]*?```)/g);

      return parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const [, language = '', code = ''] = part.match(/```(\w*)\n?([\s\S]*?)```/) || [];
          return (
            <div key={index} className="my-2 relative">
              <div className="flex justify-between items-center bg-[#1E1E1E] text-white text-xs px-4 py-2 rounded-t">
                <span>{language || 'plaintext'}</span>
                <button
                  onClick={() => copyToClipboard(code.trim(), index)}
                  className="text-gray-400 hover:text-white"
                >
                  {copiedIndex === index ? 'Copied!' : 'Copy code'}
                </button>
              </div>
              <SyntaxHighlighter
                language={language || 'plaintext'}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                }}
              >
                {code.trim()}
              </SyntaxHighlighter>
            </div>
          );
        }
        return <span key={index}>{part}</span>;
      });
    };

    return (
      <div className="">
        <div className={`grid gap-2 auto-cols-fr ${
          message.images && message.images.length > 0 
            ? `grid-cols-${Math.min(message.images.length, 3)} w-fit`
            : ''
        }`}>
          {message.images?.map((img, index) => (
            <img
              key={index}
              src={`data:${img.mediaType};base64,${img.data}`}
              alt="Uploaded content"
              className="max-w-[200px] w-full h-auto rounded-lg object-contain"
            />
          ))}
        </div>
        <div className="overflow-hidden break-words whitespace-pre-wrap text-sm md:text-base">
          {renderContent(message.content)}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex-1 overflow-y-auto px-4 pb-[calc(180px+env(safe-area-inset-bottom))] pt-4 md:pb-40">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="flex flex-col items-center justify-center mb-1">
              <img
                src="/mfu_logo_chatbot.PNG"
                alt="MFU Logo"
                className="w-24 h-24 mb-2 object-contain"
              />
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-0">
                  Welcome to
                </h1>
                <div className="text-2xl font-bold -mt-1 mb-0">
                  <span style={{
                    background: 'linear-gradient(to right, rgb(186, 12, 47), rgb(212, 175, 55))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    MFU
                  </span>{' '}
                  <span className="text-gray-800 dark:text-white">Chat{''}</span>
                  <span style={{
                    background: 'linear-gradient(to right, #00FFFF, #0099FF)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    AI
                  </span>
                </div>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-300 -mt-1">How can I help you today?</p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <div key={message.id} className="message relative">
                <div className={`flex items-start gap-3 ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full overflow-hidden ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-red-600 to-yellow-400'
                      : 'bg-transparent'
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

                  <div className={`flex flex-col space-y-2 max-w-[80%] ${
                    message.role === 'user' ? 'items-end' : 'items-start'
                  }`}>
                    <div className="text-sm text-gray-500">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                    <div className={`rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 dark:text-white'
                    }`}>
                      {message.role === 'assistant' && message.content === '' && isLoading ? (
                        <LoadingDots />
                      ) : (
                        <MessageContent message={message} />
                      )}
                    </div>
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
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white dark:bg-gray-800 border-t dark:border-gray-700 pb-[env(safe-area-inset-bottom)]">
        <form onSubmit={handleSubmit} className="p-2 md:p-4">
          <div className="flex gap-2 max-w-[90%] lg:max-w-[80%] mx-auto">
            <div className="flex-1">
              <div className="flex gap-2">
                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={(e) => handleInputChange(e)}
                  onKeyDown={(e) => handleKeyDown(e)}
                  onPaste={handlePaste}
                  className="flex-1 min-w-0 p-2 text-sm md:text-base rounded-2xl border border-gray-300 dark:border-gray-600 
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 
                    focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none
                    scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 
                    scrollbar-track-transparent hover:scrollbar-thumb-gray-400 
                    dark:hover:scrollbar-thumb-gray-500 scrollbar-thumb-rounded-full"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgb(209 213 219) transparent'
                  }}
                  placeholder={
                    isImageGenerationMode 
                      ? "Describe the image you want to generate..." 
                      : selectedImages.length > 0 
                        ? "Please describe or ask about these images..." 
                        : "Type a message..."
                  }
                  rows={1}
                  required
                />

                <button
                  type="submit"
                  disabled={!canSubmit()}
                  className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 ${
                    canSubmit()
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? (
                    <BiLoaderAlt className="w-5 h-5 animate-spin" />
                  ) : (
                    <GrSend className="w-5 h-5" style={{ filter: canSubmit() ? 'brightness(0) invert(1)' : 'none' }} />
                  )}
                </button>
              </div>
            </div>
          </div>

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />

          {selectedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 max-w-[90%] lg:max-w-[80%] mx-auto">
              {selectedImages.map((image, index) => (
                <div key={index} className="relative">
                  <img
                    src={URL.createObjectURL(image)}
                    alt={`Selected ${index + 1}`}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </form>

        <div className="p-2 md:p-4 border-t dark:border-gray-700">
          <div className="flex gap-2 max-w-[90%] lg:max-w-[80%] mx-auto">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 
                  hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedModel ? models.find(m => m.id === selectedModel)?.name || 'Select Model' : 'Select Model'}
                </span>
              </button>

              {isModelDropdownOpen && (
                <div 
                  className="absolute bottom-full left-0 right-0 mb-2 p-2 rounded-lg border border-gray-300 dark:border-gray-600 
                    bg-white dark:bg-gray-700 shadow-lg z-50"
                >
                  {models.map(model => (
                    <button
                      key={model.id}
                      className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-600
                        text-gray-900 dark:text-white transition-colors"
                      onClick={() => {
                        setSelectedModel(model.id);
                        setIsModelDropdownOpen(false);
                      }}
                    >
                      {model.name} ({model.modelType})
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className={`px-4 py-2 flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 
                hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200
                ${isImageGenerationMode ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
              onClick={() => setIsImageGenerationMode(!isImageGenerationMode)}
              title={isImageGenerationMode ? "Switch to chat mode" : "Switch to image generation mode"}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`w-5 h-5 ${isImageGenerationMode ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                />
              </svg>
              <span className="text-sm text-gray-700 dark:text-gray-300 hidden md:inline">
                {isImageGenerationMode ? "Image Mode" : "Chat Mode"}
              </span>
            </button>

            {!isImageGenerationMode && (
              <button
                type="button"
                className="px-4 py-2 flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 
                  hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                onClick={() => {
                  document.getElementById('file-upload')?.click();
                }}
              >
                <RiImageAddFill className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                <span className="text-sm text-gray-700 dark:text-gray-300 hidden md:inline">Add Image</span>
              </button>
            )}

            <button
              onClick={clearChat}
              className="px-4 py-2 text-sm bg-red-500 text-white rounded-full hover:bg-red-600 
                transition-colors whitespace-nowrap flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MFUChatbot;