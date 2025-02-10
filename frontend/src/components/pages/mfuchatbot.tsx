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
}

const modelNames: { [key: string]: string } = {
  'anthropic.claude-3-5-sonnet-20240620-v1:0': 'Claude 3.5 Sonnet',

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
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  // const [copySuccess, setCopySuccess] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);

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
          fetch(`${config.apiUrl}/api/chat/collections`, { headers })
        ]);

        if (!modelsRes.ok || !collectionsRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const modelsData = await modelsRes.json();
        const collectionsData = await collectionsRes.json();

        setModels(Array.isArray(modelsData) ? modelsData : []);
        setCollections(Array.isArray(collectionsData) ? collectionsData : []);

        // ถ้ามี collections ให้เลือกอันแรกเป็นค่าเริ่มต้น
        if (Array.isArray(collectionsData) && collectionsData.length > 0) {
          setSelectedCollection(collectionsData[0]);
        }
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

    try {
      let processedImages;
      if (selectedImages.length > 0) {
        processedImages = await Promise.all(
          selectedImages.map(async (file) => {
            const base64 = await compressImage(file);
            return base64;
          })
        );
      }

      const newMessage = {
        id: messages.length + 1,
        role: 'user' as const,
        content: inputMessage.trim(),
        timestamp: new Date(),
        images: processedImages
      };

      // เพิ่มข้อความผู้ใช้
      setMessages(prev => [...prev, newMessage]);
      setInputMessage('');
      setSelectedImages([]);

      // เพิ่มข้อความ AI เปล่าๆ
      const aiMessage = {
        id: messages.length + 2,
        role: 'assistant' as const,
        content: '',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);

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

      if (!response.ok) throw new Error('Failed to get response');
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedText = '';

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const { content } = JSON.parse(line.slice(5));
                if (content) {
                  streamedText += content;
                  // อัพเดท UI ทันทีที่ได้รับแต่ละ chunk
                  setMessages(prevMessages => 
                    prevMessages.map(msg => 
                      msg.id === aiMessage.id 
                        ? { ...msg, content: streamedText }
                        : msg
                    )
                  );
                }
              } catch (e) {
                console.error('Error parsing chunk:', e);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // บันทึกประวัติแชทหลังจากได้ข้อความครบ
      await fetch(`${config.apiUrl}/api/chat/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          messages: [...messages, newMessage, { ...aiMessage, content: streamedText }],
          modelId: selectedModel,
          collectionName: selectedCollection
        })
      });

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        id: messages.length + 2,
        role: 'assistant',
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

  // const handleCopy = (content: string) => {
  //   navigator.clipboard.writeText(content).then(() => {
  //     setCopySuccess(true);
  //     setTimeout(() => setCopySuccess(false), 2000); // Hide message after 2 seconds
  //   });
  // };

  // const isDayTime = () => {
  //   const hour = new Date().getHours();
  //   return hour >= 6 && hour < 18; // Assuming day time is from 6 AM to 6 PM
  // };

  // เพิ่มฟังก์ชันสำหรับตรวจสอบขนาดไฟล์
  const validateImageFile = (file: File): boolean => {
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      alert('Image size must not exceed 20MB');
      return false;
    }
    return true;
  };

  // อัพเดทฟังก์ชัน handlePaste
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;

    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault(); // ป้องกันการวางข้อความ
          const file = item.getAsFile();
          if (file && validateImageFile(file)) {
            setSelectedImages(prev => [...prev, file]);
          }
          break;
        }
      }
    }
  };

  // เพิ่มการตรวจสอบว่าสามารถส่งข้อความได้หรือไม่
  const canSubmit = () => {
    return (
      !isLoading &&
      selectedModel &&
      selectedCollection &&
      inputMessage.trim()
    );
  };

  // เพิ่มฟังก์ชันสำหรับจัดการการเลือกไฟล์
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setSelectedImages(prev => [...prev, ...Array.from(files)]);
    }
  };

  // ฟังก์ชันลบรูปภาพที่เลือก
  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // เพิ่มฟังก์ชันสำหรับแปลงข้อความเป็น component
  const MessageContent = ({ content }: { content: string }) => {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const copyToClipboard = (code: string, index: number) => {
      navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    };

    const parts = content.split(/(```[\s\S]*?```)/g);

    return (
      <div className="whitespace-pre-wrap text-sm md:text-base">
        {parts.map((part, index) => {
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
        })}
      </div>
    );
  };

  const renderMessages = () => {
    return messages.map((message) => (
      <div
        key={message.id}
        className={`flex items-start gap-3 ${
          message.role === 'user' ? 'flex-row-reverse' : ''
        }`}
      >
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
          <img
            src={message.role === 'user' ? '/images/user.png' : '/images/ai.png'}
            alt={message.role === 'user' ? 'User' : 'AI'}
            className="w-full h-full object-cover"
          />
        </div>
        <div
          className={`flex flex-col space-y-2 max-w-[80%] ${
            message.role === 'user' ? 'items-end' : 'items-start'
          }`}
        >
          <div className="text-sm text-gray-500">
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
          <div
            className={`rounded-lg p-3 ${
              message.role === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 dark:text-white'
            }`}
          >
            <MessageContent content={message.content} />
          </div>
        </div>
      </div>
    ));
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {renderMessages()}
        <div ref={messagesEndRef} />
      </div>

      {/* Fixed Bottom Container */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white dark:bg-gray-800 border-t dark:border-gray-700 pb-[env(safe-area-inset-bottom)]">
        {/* Controls */}
        <div className="p-2 md:p-4 border-b">
          <div className="flex gap-2 max-w-[90%] lg:max-w-[80%] mx-auto">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="p-1 md:p-2 text-sm md:text-base border rounded flex-1 max-w-[120px] md:max-w-[150px] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Model</option>
              {models.map(model => (
                <option key={model} value={model}>
                  {modelNames[model]}
                </option>
              ))}
            </select>
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="p-1 md:p-2 text-sm md:text-base border rounded flex-1 max-w-[120px] md:max-w-[150px] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Select Collection</option>
              {collections.map(collection => (
                <option key={collection} value={collection}>
                  {collection}
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

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-2 md:p-4">
          <div className="flex gap-2 max-w-[90%] lg:max-w-[80%] mx-auto">
            {/* ปรับปุ่ม Add image */}
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

              {/* แสดงรูปภาพที่เลือก */}
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
                  onChange={(e) => handleInputChange(e)}
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