import React, { useState, useRef, useEffect } from 'react';
import { BiLoaderAlt } from 'react-icons/bi';
import { GrSend } from "react-icons/gr";
import { config } from '../../config/config';
import { RiImageAddFill } from 'react-icons/ri';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

/* -------------------------------
   Type Definitions
---------------------------------*/
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
}

/* -------------------------------
   Utility Components
---------------------------------*/
const LoadingDots = () => (
  <div className="flex items-center space-x-1">
    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
  </div>
);

//const modelNames: { [key: string]: string } = {
  //'anthropic.claude-3-5-sonnet-20240620-v1:0': 'Claude 3.5 Sonnet',
  // Add more mappings as needed
//};

/* -------------------------------
   Custom Hooks for API Integration
---------------------------------*/

/**
 * useChatMetadata:
 * Fetches available models from /api/training/models and accessible collections from /api/chat/collections.
 */
function useChatMetadata() {
  const [models, setModels] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);

  useEffect(() => {
    const fetchMetadata = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No auth token found');
        return;
      }
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      try {
        // Get available models
        const modelsRes = await fetch(`${config.apiUrl}/api/training/models`, { headers });
        if (modelsRes.ok) {
          const modelsData = await modelsRes.json();
          setModels(Array.isArray(modelsData) ? modelsData : []);
        }
        // Get accessible collections. (Uses the new chat endpoint.)
        const collectionsRes = await fetch(`${config.apiUrl}/api/chat/collections`, { headers });
        if (collectionsRes.ok) {
          const collectionsData = await collectionsRes.json();
          setCollections(Array.isArray(collectionsData) ? collectionsData : []);
        }
      } catch (error) {
        console.error('Error fetching metadata:', error);
      }
    };

    fetchMetadata();
  }, []);

  return { models, collections };
}

/**
 * useChatHistory:
 * Loads the chat history for the currently authenticated user from /api/chat/history.
 */
function useChatHistory() {
  const [history, setHistory] = useState<Message[]>([]);
  useEffect(() => {
    const loadHistory = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      try {
        const response = await fetch(`${config.apiUrl}/api/chat/history`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.messages) {
            setHistory(data.messages);
          }
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    };

    loadHistory();
  }, []);
  return { history, setHistory };
}

/* -------------------------------
   Message Rendering Component
---------------------------------*/
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
    <div>
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

/* -------------------------------
   Main Chatbot Component
---------------------------------*/
const MFUChatbot: React.FC = () => {
  // Local state
  const { models, collections } = useChatMetadata();
  const { history, setHistory } = useChatHistory();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // When chat history loads, synchronize with messages state.
  useEffect(() => {
    setMessages(history);
    if (collections.length > 0 && !selectedModel) {
      // Set default collection (first accessible one)
      setSelectedModel(collections[0]);
    }
  }, [history, collections, selectedModel]);

  // Scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Detect mobile device
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Auto-resize textarea (up to a defined max height)
  const autoResize = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const lineHeight = 10;
      const maxLines = 6;
      const maxHeight = lineHeight * maxLines;
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  };
  useEffect(() => {
    autoResize();
  }, [inputMessage]);

  /* -------------------------------
     Image Compression (for image uploads)
  ---------------------------------*/
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

  /* -------------------------------
     Chat History Storage
     (Integrates with POST /api/chat/history)
  ---------------------------------*/
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
      // Update the history hook state as well
      setHistory(messages);
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  /* -------------------------------
     Chat Message Submission
     Uses a WebSocket (integrated with new backend chat service)
  ---------------------------------*/
  const canSubmit = () => {
    return (
      !isLoading &&
      selectedModel &&
      inputMessage.trim().length > 0
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit()) return;

    setIsLoading(true);
    // Generate new message id(s). (A more robust solution may use UUIDs.)
    const userMessageId = messages.length + 1;
    const aiMessageId = messages.length + 2;
    let accumulatedContent = '';

    try {
      // (Re)initialize the WebSocket connection using the new chat server endpoint.
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        wsRef.current = new WebSocket(import.meta.env.VITE_WS_URL);
        await new Promise((resolve, reject) => {
          wsRef.current!.onopen = resolve;
          wsRef.current!.onerror = reject;
        });
      }

      // Process attached images (if any)
      let processedImages;
      if (selectedImages.length > 0) {
        processedImages = await Promise.all(
          selectedImages.map(async (file) => await compressImage(file))
        );
      }

      const userMessage: Message = {
        id: userMessageId,
        role: 'user',
        content: inputMessage.trim(),
        timestamp: new Date(),
        images: processedImages
      };

      // Append the user message and clear the input
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');
      setSelectedImages([]);

      // Add a placeholder assistant message (streaming output will update it)
      setMessages(prev => [
        ...prev,
        { id: aiMessageId, role: 'assistant', content: '', timestamp: new Date() }
      ]);

      // Set up a local variable to accumulate streaming chunks
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.content) {
            accumulatedContent += data.content;
            setMessages(prev => prev.map(msg =>
              msg.id === aiMessageId ? { ...msg, content: accumulatedContent } : msg
            ));
          }
          if (data.done) {
            // Append sources (if provided) and then save updated chat history.
            const assistantMessage: Message = {
              id: aiMessageId,
              role: 'assistant',
              content: accumulatedContent,
              timestamp: new Date(),
              sources: data.sources
            };
            const updatedMessages = [...messages, userMessage, assistantMessage];
            saveChatHistory(updatedMessages);
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Error parsing message chunk:', error);
        }
      };

      // Send payload: messages, selected model.
      wsRef.current.send(JSON.stringify({
        messages: [...messages, userMessage],
        modelId: selectedModel
      }));
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      const errorMessage: Message = {
        id: aiMessageId,
        role: 'assistant',
        content: 'ขออภัย มีข้อผิดพลาดเกิดขึ้น กรุณาลองใหม่อีกครั้ง',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  /* -------------------------------
     Clear Chat History (calls DELETE /api/chat/clear)
  ---------------------------------*/
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
      setHistory([]);
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  /* -------------------------------
     File/Image Handlers
  ---------------------------------*/
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setSelectedImages(prev => [...prev, ...Array.from(files).filter(validateImageFile)]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  /* -------------------------------
     Keyboard handler for textarea:
     On desktop, Enter sends; on mobile, newlines are allowed.
  ---------------------------------*/
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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Chat history / messages container */}
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
                  <span className="text-gray-800 dark:text-white">Chat</span>{' '}
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
                <div className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full overflow-hidden ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-red-600 to-yellow-400'
                      : 'bg-transparent'
                  } flex items-center justify-center`}>
                    {message.role === 'user' ? (
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd"
                              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                              clipRule="evenodd" />
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
                    <div className={`rounded-lg p-3 ${message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 dark:text-white'}`}>
                      {(message.role === 'assistant' && message.content === '' && isLoading)
                        ? <LoadingDots />
                        : <MessageContent message={message} />
                      }
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

      {/* Chat controls (model selection, and clear chat) */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white dark:bg-gray-800 border-t dark:border-gray-700 pb-[env(safe-area-inset-bottom)]">
        <div className="p-2 md:p-4 border-b">
          <div className="flex gap-2 max-w-[90%] lg:max-w-[80%] mx-auto">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="p-1 md:p-2 text-sm md:text-base border rounded flex-1 max-w-[150px] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Model</option>
              {models.map((modelName) => (
                <option key={modelName} value={modelName}>
                  {modelName}
                </option>
              ))}
            </select>
            <button
              onClick={clearChat}
              className="px-3 py-1 md:px-4 md:py-2 text-sm md:text-base bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors whitespace-nowrap"
            >
              Clear Chat
            </button>
          </div>
        </div>

        {/* Chat input form */}
        <form onSubmit={handleSubmit} className="p-2 md:p-4">
          <div className="flex gap-2 max-w-[90%] lg:max-w-[80%] mx-auto">
            <div className="flex items-center gap-2 p-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <RiImageAddFill className="w-6 h-6 text-gray-500 dark:text-white hover:text-gray-700 dark:hover:text-gray-300" />
              </label>
              {selectedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedImages.map((image, index) => (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(image)}
                        alt={`Selected ${index + 1}`}
                        className="w-20 h-20 object-cover rounded"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex gap-2">
                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e)}
                  onPaste={handlePaste}
                  className="flex-1 min-w-0 p-2 text-sm md:text-base border rounded resize-none"
                  placeholder={selectedImages.length > 0 ? "Please describe or ask about these images..." : "Type a message..."}
                  rows={1}
                  required
                />
                <button
                  type="submit"
                  disabled={!canSubmit()}
                  className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 h-fit ${canSubmit()
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  style={{ minHeight: '40px' }}
                >
                  {isLoading ? (
                    <BiLoaderAlt className="w-6 h-6 animate-spin" />
                  ) : (
                    <GrSend className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MFUChatbot;