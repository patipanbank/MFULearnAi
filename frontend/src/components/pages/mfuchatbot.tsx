import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { BiLoaderAlt } from 'react-icons/bi';
import { GrSend } from "react-icons/gr";
import { config } from '../../config/config';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FaPlus } from 'react-icons/fa';

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

// This is the local model type stored by modelCreation.tsx
export interface Model {
  id: string;
  name: string;
  collections: string[];
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

/* -------------------------------
   Custom Hooks for API Integration
---------------------------------*/

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
      <div className={`grid gap-3 auto-cols-fr ${
        message.images && message.images.length > 0 
          ? `grid-cols-${Math.min(message.images.length, 3)} w-fit`
          : ''
      }`}>
        {message.images?.map((img, index) => (
          <div key={index} className="relative group transform hover:scale-105 transition-all duration-200">
            <img
              src={`data:${img.mediaType};base64,${img.data}`}
              alt="Uploaded content"
              className="max-w-[200px] w-full h-auto rounded-xl object-contain 
              transition-all duration-300"
            />
          </div>
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
  const { history, setHistory } = useChatHistory();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // When chat history loads, synchronize with messages state.
  useEffect(() => {
    setMessages(history);
  }, [history]);

  // Load models from localStorage only once upon component mount.
  useEffect(() => {
    const storedModels = localStorage.getItem('models');
    if (storedModels) {
      const parsedModels: Model[] = JSON.parse(storedModels);
      setSelectedModel(parsedModels[0]);
    }
  }, []); // Dependency array is empty to ensure one-time execution

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
          modelId: selectedModel?.id
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit() || !selectedModel) return;

    setIsLoading(true);
    // Generate new message IDs. (In production consider using UUIDs)
    const userMessageId = messages.length + 1;
    const aiMessageId = messages.length + 2;
    let accumulatedContent = '';

    try {
      // (Re)initialize WebSocket connection if needed
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        wsRef.current = new WebSocket(import.meta.env.VITE_WS_URL);
        await new Promise((resolve, reject) => {
          wsRef.current!.onopen = resolve;
          wsRef.current!.onerror = reject;
        });
      }

      // Process attached images if any
      let processedImages;
      if (selectedImages.length > 0) {
        processedImages = await Promise.all(
          selectedImages.map(async (file) => await compressImage(file))
        );
      }

      // Create the user message
      const userMessage: Message = {
        id: userMessageId,
        role: 'user',
        content: inputMessage.trim(),
        timestamp: new Date(),
        images: processedImages,
      };

      // Append the user message and clear the input
      setMessages((prev) => [...prev, userMessage]);
      setInputMessage('');
      setSelectedImages([]);

      // Add a placeholder assistant message (its content will be updated via streaming)
      setMessages((prev) => [
        ...prev,
        { id: aiMessageId, role: 'assistant', content: '', timestamp: new Date() },
      ]);

      // Extract the collections from the selected model.
      // (Make sure your model has collections. If not, no context will be queried.)
      const collectionsToQuery: string[] = selectedModel.collections;

      // Debug logging to verify that the correct model and its collections are being sent.
      console.log('Selected Model:', selectedModel);
      console.log('Model Collections (for vector query):', collectionsToQuery);

      // Prepare the payload.
      // NOTE: The collection names here must exactly match what was used during file upload and what the backend expects.
      const payload = {
        messages: [...messages, userMessage],
        modelId: selectedModel.id,
        collections: selectedModel.collections,
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.content) {
            accumulatedContent += data.content;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId ? { ...msg, content: accumulatedContent } : msg
              )
            );
          }
          if (data.done) {
            // Update the assistant message with sources (if provided) and save chat history.
            const assistantMessage: Message = {
              id: aiMessageId,
              role: 'assistant',
              content: accumulatedContent,
              timestamp: new Date(),
              sources: data.sources,
            };
            const updatedMessages = [...messages, userMessage, assistantMessage];
            saveChatHistory(updatedMessages);
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Error parsing message chunk:', error);
        }
      };

      // Send the payload including both the selected model's ID and its collections.
      wsRef.current.send(JSON.stringify(payload));
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      const errorMessage: Message = {
        id: aiMessageId,
        role: 'assistant',
        content: 'ขออภัย มีข้อผิดพลาดเกิดขึ้น กรุณาลองใหม่อีกครั้ง',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
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
    <div className="flex flex-col h-screen">
      {/* Chat history / messages container */}
      <div className={`flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 
      ${messages.length === 0 ? 'flex items-center justify-center' : 'pt-4'} 
      bg-gray-800
      [&::-webkit-scrollbar]:w-3
      [&::-webkit-scrollbar-track]:bg-[var(--sidebar-surface-secondary,#1f1f1f)]
      [&::-webkit-scrollbar-thumb]:bg-[var(--sidebar-surface-tertiary,#2b2b2b)]
      [&::-webkit-scrollbar-thumb]:rounded-full
      [&::-webkit-scrollbar-thumb]:border-2
      [&::-webkit-scrollbar-thumb]:border-[var(--sidebar-surface-secondary,#1f1f1f)]
      [&::-webkit-scrollbar-thumb]:hover:bg-[var(--sidebar-icon,#a4a4a4)]
      scrollbar-thin
      scrollbar-track-[var(--sidebar-surface-secondary,#1f1f1f)]
      scrollbar-thumb-[var(--sidebar-surface-tertiary,#2b2b2b)]
      hover:scrollbar-thumb-[var(--sidebar-icon,#a4a4a4)]`}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-4">
            <div className="flex flex-col items-center justify-center mb-1">
              <div className="w-24 h-24 mb-4 rounded-2xl shadow-xl overflow-hidden transform 
              hover:scale-105 transition-all duration-300">
                <img
                  src="/mfu_logo_chatbot.PNG"
                  alt="MFU Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 
                dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                  Welcome to
                </h1>
                <div className="text-3xl font-bold">
                  <span className="bg-gradient-to-r from-red-600 to-yellow-400 bg-clip-text text-transparent">
                    MFU
                  </span>{' '}
                  <span className="bg-gradient-to-r from-gray-900 to-gray-700 
                  dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">Chat</span>{' '}
                  <span className="bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
                    AI
                  </span>
                </div>
              </div>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300 mt-4">
              How can I help you today?
            </p>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto pb-24">
            {/* Messages */}
            {messages.map((message) => (
              <div key={message.id} className="message relative transform transition-all duration-200">
                <div className={`flex items-start gap-4 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden shadow-md 
                  transform hover:scale-105 transition-all duration-200 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700'
                      : 'bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800'
                  } flex items-center justify-center`}>
                    {message.role === 'user' ? (
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <img
                        src="/dindin.PNG"
                        alt="AI Assistant"
                        className="w-full h-full object-cover transform hover:scale-110 transition-all duration-200"
                      />
                    )}
                  </div>

                  <div className={`flex flex-col space-y-2 max-w-[80%] ${
                    message.role === 'user' ? 'items-end' : 'items-start'
                  }`}>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                    <div className={`rounded-2xl p-4 shadow-md hover:shadow-lg transition-all duration-200 w-full ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                        : 'bg-white dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700'
                    }`}>
                      {(message.role === 'assistant' && message.content === '' && isLoading)
                        ? <LoadingDots />
                        : <MessageContent message={message} />
                      }
                    </div>
                  </div>
                </div>

                {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                  <div className="ml-14 mt-2">
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
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 
                      dark:hover:text-blue-300 flex items-center gap-2 px-3 py-1.5 rounded-lg 
                      bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 
                      transition-all duration-200"
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

      {/* Chat Input Form - Now part of the main container */}
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 pb-6 dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4">
          <div className="flex gap-3">
            {/* Clear Chat Button */}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to clear the chat history?')) {
                  clearChat();
                }
              }}
              className="flex items-center justify-center w-9 h-9 text-red-600 
              hover:text-red-700 dark:text-red-400 dark:hover:text-red-300
              rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 
              dark:hover:bg-gray-700 transition-all duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>

            {/* Image Upload Button */}
            <label className="flex items-center justify-center w-9 h-9 cursor-pointer
              text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300
              rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 
              dark:hover:bg-gray-700 transition-all duration-200">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <FaPlus className="h-4 w-4" />
            </label>

            <div className="flex-1 flex flex-col gap-3">
              {/* Selected Images Preview */}
              {selectedImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedImages.map((image, index) => (
                    <div key={index} className="relative group transform hover:scale-105 transition-all duration-200">
                      <img
                        src={URL.createObjectURL(image)}
                        alt={`Selected ${index + 1}`}
                        className="w-20 h-20 object-cover rounded-xl 
                        transition-all duration-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white 
                        rounded-full w-6 h-6 flex items-center justify-center text-sm
                        transform hover:scale-110 transition-all duration-200"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input Area */}
              <div className="flex gap-3">
                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  className="flex-1 min-w-0 p-3 text-sm md:text-base rounded-3xl border border-gray-300 
                  dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
                  placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:ring-2 
                  focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent 
                  transition-all duration-200"
                  placeholder={selectedImages.length > 0 
                    ? "Please describe or ask about these images..." 
                    : "Ask anything..."}
                  rows={1}
                  required
                />
                <button
                  type="submit"
                  disabled={!canSubmit()}
                  className={`p-3 rounded-full font-medium flex items-center justify-center 
                  transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg 
                  min-h-[44px] min-w-[44px] ${
                    canSubmit()
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  }`}
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