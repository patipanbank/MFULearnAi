// import React, { useState, useRef, useEffect } from 'react';
// import { useNavigate, useLocation } from 'react-router-dom';
// import { config } from '../../config/config';
// import { RiImageAddFill } from 'react-icons/ri';
// import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// interface Source {
//   modelId: string;
//   collectionName: string;
//   filename: string;
//   source?: string;
//   similarity: number;
// }

// interface MongoDBId {
//   $oid: string;
// }

// interface MongoDBDate {
//   $date: string;
// }

// interface Message {
//   id: number | string;
//   role: 'user' | 'assistant' | 'system';
//   content: string;
//   timestamp: { $date: string };
//   images?: { data: string; mediaType: string }[];
//   sources?: Source[];
//   isImageGeneration?: boolean;
//   isComplete?: boolean;
// }

// interface ChatHistory {
//   _id: MongoDBId;
//   userId: string;
//   modelId: string;
//   collectionName: string;
//   chatname: string;
//   messages: Message[];
//   updatedAt: MongoDBDate;
//   createdAt: MongoDBDate;
//   sources: Source[];
//   __v: number;
// }

// interface Model {
//   id: string;
//   name: string;
//   modelType: 'official' | 'personal';
// }

// // const modelNames: { [key: string]: string } = {
// //   'anthropic.claude-3-5-sonnet-20240620-v1:0': 'Claude 3.5 Sonnet',
// // };

// const LoadingDots = () => (
//   <div className="flex items-center space-x-1">
//     <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
//     <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
//     <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
//   </div>
// );

// const MFUChatbot: React.FC = () => {
//   const navigate = useNavigate();
//   const location = useLocation();
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [inputMessage, setInputMessage] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const [isImageGenerationMode, setIsImageGenerationMode] = useState(false);
//   const [currentChatId, setCurrentChatId] = useState<string | null>(null);
//   const messagesEndRef = useRef<HTMLDivElement>(null);
//   const textareaRef = useRef<HTMLTextAreaElement>(null);
//   const dropdownRef = useRef<HTMLDivElement>(null);
//   const [isMobile, setIsMobile] = useState(false);
//   const [models, setModels] = useState<Model[]>([]);
//   const [selectedModel, setSelectedModel] = useState('');
//   const [selectedImages, setSelectedImages] = useState<File[]>([]);
//   const wsRef = useRef<WebSocket | null>(null);
//   const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
//   const [usage, setUsage] = useState<{
//     dailyQuestions: number;
//     dailyLimit: number;
//     remainingQuestions: number;
//   } | null>(null);

//   // Add click outside handler
//   useEffect(() => {
//     const handleClickOutside = (event: MouseEvent) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
//         setIsModelDropdownOpen(false);
//       }
//     };

//     document.addEventListener('mousedown', handleClickOutside);
//     return () => {
//       document.removeEventListener('mousedown', handleClickOutside);
//     };
//   }, []);

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   };

//   useEffect(() => {
//     scrollToBottom();
//   }, [messages, isLoading]);

//   useEffect(() => {
//     const checkIfMobile = () => {
//       setIsMobile(window.innerWidth < 768);
//     };
//     checkIfMobile();
//     window.addEventListener('resize', checkIfMobile);
//     return () => window.removeEventListener('resize', checkIfMobile);
//   }, []);

//   const autoResize = () => {
//     const textarea = textareaRef.current;
//     if (textarea) {
//       textarea.style.height = 'auto';
//       const lineHeight = 24;
//       const maxLines = 5;
//       const maxHeight = lineHeight * maxLines;
//       const newHeight = Math.min(textarea.scrollHeight, maxHeight);
//       textarea.style.height = `${newHeight}px`;
//     }
//   };

//   useEffect(() => {
//     autoResize();
//   }, [inputMessage]);

//   useEffect(() => {
//     const fetchModels = async () => {
//       try {
//         const token = localStorage.getItem('auth_token');
//         if (!token) {
//           console.error('No auth token found');
//           return;
//         }

//         // Validate token format
//         const tokenParts = token.split('.');
//         if (tokenParts.length !== 3) {
//           console.error('Invalid token format');
//           return;
//         }

//         // console.log('Fetching models with token:', `Bearer ${token}`);
//         // ดึงโมเดลทั้งหมดจาก API
//         const response = await fetch(`${config.apiUrl}/api/models`, {
//           headers: {
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json'
//           }
//         });

//         if (!response.ok) {
//           const errorText = await response.text();
//           console.error('Failed to fetch models:', response.status, errorText);
          
//           if (response.status === 401) {
//             localStorage.removeItem('auth_token');
//             window.location.href = '/login';
//             return;
//           }
          
//           throw new Error(`Failed to fetch models: ${errorText}`);
//         }

//         const dbModels = await response.json();
        
//         // แปลงข้อมูลโมเดลให้อยู่ในรูปแบบที่ต้องการ
//         const allModels = dbModels.map((model: any) => ({
//           id: model._id,
//           name: model.name,
//           modelType: model.modelType
//         }));

//         // console.log('Loaded models:', allModels);
//         setModels(allModels);

//         // ตั้งค่าโมเดลเริ่มต้น
//         if (allModels.length > 0) {
//           const defaultModel = allModels.find((model: any) => model.name === 'Default') || allModels[0];
//           setSelectedModel(defaultModel.id);
//         }
//       } catch (error) {
//         console.error('Error fetching models:', error);
//         if (error instanceof Error) {
//           alert(error.message);
//         }
//         setModels([]);
//       }
//     };

//     fetchModels();
//   }, []);

//   const loadChatHistory = async () => {
//     try {
//       const urlParams = new URLSearchParams(location.search);
//       const chatId = urlParams.get('chat');
      
//       // Add validation for MongoDB ObjectId format
//       const isValidObjectId = (id: string | null): boolean => {
//         if (!id) return false;
//         return /^[0-9a-fA-F]{24}$/.test(id);
//       };
      
//       if (!chatId) {
//         // console.log('No chat ID provided, starting new chat');
//         return;
//       }

//       if (!isValidObjectId(chatId)) {
//         console.warn(`Invalid chat ID format: ${chatId}, starting new chat`);
//         // Remove the invalid chatId from URL
//         navigate('/mfuchatbot', { replace: true });
//         return;
//       }

//       const token = localStorage.getItem('auth_token');
//       if (!token) {
//         // console.log('No authentication token found');
//         navigate('/login');
//         return;
//       }

//       const response = await fetch(`${config.apiUrl}/api/chat/chats/${chatId}`, {
//         headers: {
//           'Authorization': `Bearer ${token}`
//         }
//       });

//       if (response.ok) {
//         const chat: ChatHistory = await response.json();
//         // console.log('Loaded chat:', chat);
        
//         // Convert MongoDB ObjectId to string if necessary
//         const chatIdString = typeof chat._id === 'string' ? chat._id : chat._id.$oid;
//         setCurrentChatId(chatIdString);
        
//         if (chat.modelId) {
//           setSelectedModel(chat.modelId);
//         }

//         if (chat.messages && Array.isArray(chat.messages)) {
//           const processedMessages = chat.messages.map((msg) => ({
//             ...msg,
//             timestamp: msg.timestamp,
//             images: msg.images || [],
//             sources: msg.sources || [],
//             isImageGeneration: msg.isImageGeneration || false,
//             isComplete: true
//           }));
//           setMessages(processedMessages);
//         }
//       } else {
//         const errorData = await response.text();
//         console.error('Failed to load chat:', errorData);
//         // Remove the invalid chatId from URL
//         navigate('/mfuchatbot', { replace: true });
//       }
//     } catch (error) {
//       console.error('Error loading chat history:', error);
//       // Remove the invalid chatId from URL
//       navigate('/mfuchatbot', { replace: true });
//     }
//   };

//   useEffect(() => {
//     const urlParams = new URLSearchParams(location.search);
//     const chatId = urlParams.get('chat');

//     if (chatId) {
//       loadChatHistory();
//     } else {
//       // Reset state for new chat but keep selected model
//       setMessages([]);
//       setCurrentChatId(null);
//       setInputMessage('');
//       setSelectedImages([]);
//       setIsImageGenerationMode(false);
      
//       // If no model is selected, set default model
//       if (!selectedModel && models.length > 0) {
//         const defaultModel = models.find(model => model.name === 'Default');
//         setSelectedModel(defaultModel?.id || models[0].id);
//       }
//     }
//   }, [location.search, models]);

//   const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
//     setInputMessage(e.target.value);
//   };

//   const compressImage = async (file: File): Promise<{ data: string; mediaType: string }> => {
//     return new Promise((resolve) => {
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const img = new Image();
//         img.onload = () => {
//           const canvas = document.createElement('canvas');
//           let width = img.width;
//           let height = img.height;

//           const MAX_WIDTH = 1024;
//           const MAX_HEIGHT = 1024;

//           if (width > height) {
//             if (width > MAX_WIDTH) {
//               height *= MAX_WIDTH / width;
//               width = MAX_WIDTH;
//             }
//           } else {
//             if (height > MAX_HEIGHT) {
//               width *= MAX_HEIGHT / height;
//               height = MAX_HEIGHT;
//             }
//           }

//           canvas.width = width;
//           canvas.height = height;

//           const ctx = canvas.getContext('2d');
//           ctx?.drawImage(img, 0, 0, width, height);

//           const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
//           resolve({
//             data: compressedBase64.split(',')[1],
//             mediaType: 'image/jpeg'
//           });
//         };
//         img.src = e.target?.result as string;
//       };
//       reader.readAsDataURL(file);
//     });
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!inputMessage.trim() && !isImageGenerationMode) return;
//     if (!selectedModel) {
//       alert('Please select a model first');
//       return;
//     }

//     setIsLoading(true);

//     try {
//       const token = localStorage.getItem('auth_token');
//       if (!token || !wsRef.current) {
//         throw new Error('Not authenticated or WebSocket not connected');
//       }

//       const userMessage: Message = {
//         id: messages.length + 1,
//         role: 'user',
//         content: inputMessage.trim(),
//         timestamp: {
//           $date: new Date().toISOString()
//         },
//         images: !isImageGenerationMode && selectedImages.length > 0 ? 
//           await Promise.all(selectedImages.map(async (file) => await compressImage(file))) 
//           : [],
//         sources: [],
//         isImageGeneration: isImageGenerationMode
//       };

//       // Add user message to state
//       const updatedMessages = [...messages, userMessage];
//       setMessages(updatedMessages);

//       // Add placeholder for AI response
//       const assistantMessage: Message = {
//         id: messages.length + 2,
//         role: 'assistant',
//         content: '',
//         timestamp: {
//           $date: new Date().toISOString()
//         },
//         images: [],
//         sources: [],
//         isImageGeneration: isImageGenerationMode,
//         isComplete: false
//       };
//       setMessages([...updatedMessages, assistantMessage]);

//       // Send message to WebSocket
//       const messagePayload = {
//         messages: updatedMessages,
//         modelId: selectedModel,
//         isImageGeneration: isImageGenerationMode,
//         path: location.pathname,
//         chatId: currentChatId
//       };

//       wsRef.current?.send(JSON.stringify(messagePayload));

//       // อัพเดท usage ทันทีหลังส่งข้อความ
//       await fetchUsage();

//     } catch (error) {
//       console.error('Error in handleSubmit:', error);
//       setMessages(prev => [...prev.slice(0, -1), {
//         id: messages.length + 2,
//         role: 'assistant',
//         content: error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred',
//         timestamp: {
//           $date: new Date().toISOString()
//         },
//         images: [],
//         sources: [],
//         isImageGeneration: false,
//         isComplete: true
//       }]);
//     } finally {
//       setIsLoading(false);
//       setInputMessage('');
//       setSelectedImages([]);
//     }
//   };

//   useEffect(() => {
//     const token = localStorage.getItem('auth_token');
//     if (!token) return;

//     const wsUrl = new URL(import.meta.env.VITE_WS_URL);
//     wsUrl.searchParams.append('token', token);
    
//     // Add validation for MongoDB ObjectId format
//     const isValidObjectId = (id: string | null): boolean => {
//       if (!id) return false;
//       return /^[0-9a-fA-F]{24}$/.test(id);
//     };
    
//     // Only append chatId if it's a valid ObjectId
//     if (currentChatId && isValidObjectId(currentChatId)) {
//       // console.log('Adding valid chatId to WebSocket URL:', currentChatId);
//       wsUrl.searchParams.append('chat', currentChatId);
//     } else {
//       // console.log('No valid chatId to add to WebSocket URL');
//     }
    
//     wsRef.current = new WebSocket(wsUrl.toString());

//     wsRef.current.onopen = () => {
//       // console.log('WebSocket connection established');
//     };

//     wsRef.current.onmessage = async (event) => {
//       try {
//         const data = JSON.parse(event.data);
        
//         if (data.error) {
//           console.error('Received error from WebSocket:', data.error);
//           setMessages(prev => prev.map((msg, index) => 
//             index === prev.length - 1 && msg.role === 'assistant' ? {
//               ...msg,
//               content: `Error: ${data.error}`,
//               isComplete: true
//             } : msg
//           ));
//           return;
//         }

//         // Handle different message types
//         switch (data.type) {
//           case 'chat_created':
//             // Just store the chatId, don't update URL yet
//             setCurrentChatId(data.chatId);
//             break;

//           case 'content':
//             setMessages(prev => prev.map((msg, index) => 
//               index === prev.length - 1 && msg.role === 'assistant' ? {
//                 ...msg,
//                 content: msg.content + data.content
//               } : msg
//             ));
//             break;

//           case 'complete':
//             setMessages(prev => {
//               const updatedMessages = prev.map((msg, index) => 
//                 index === prev.length - 1 && msg.role === 'assistant' ? {
//                   ...msg,
//                   sources: data.sources || [],
//                   isComplete: true
//                 } : msg
//               );
//               return updatedMessages;
//             });
            
//             // Now that the response is complete, update URL with chatId
//             if (data.chatId) {
//               setCurrentChatId(data.chatId);
//               navigate(`/mfuchatbot?chat=${data.chatId}`, { replace: true });
//               window.dispatchEvent(new CustomEvent('chatUpdated'));
//             }
//             break;

//           case 'chat_updated':
//             if (data.shouldUpdateList) {
//               window.dispatchEvent(new CustomEvent('chatHistoryUpdated'));
//             }
//             break;

//           case 'error':
//             console.error('Error from server:', data.error);
//             setMessages(prev => prev.map((msg, index) => 
//               index === prev.length - 1 && msg.role === 'assistant' ? {
//                 ...msg,
//                 content: `Error: ${data.error}`,
//                 isComplete: true
//               } : msg
//             ));
//             break;
//         }

//         // อัพเดท usage หลังจากได้รับข้อความ
//         if (data.type === 'complete') {
//           await fetchUsage();
//         }
//       } catch (error) {
//         console.error('Error handling WebSocket message:', error);
//         setMessages(prev => prev.map((msg, index) => 
//           index === prev.length - 1 && msg.role === 'assistant' ? {
//             ...msg,
//             content: 'Error processing response. Please try again.',
//             isComplete: true
//           } : msg
//         ));
//       }
//     };

//     wsRef.current.onclose = () => {
//       // console.log('WebSocket connection closed');
//     };

//     wsRef.current.onerror = (error) => {
//       console.error('WebSocket error:', error);
//     };

//     return () => {
//       if (wsRef.current?.readyState === WebSocket.OPEN) {
//         wsRef.current.close();
//       }
//     };
//   }, [navigate]);

//   const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
//     if (e.key === 'Enter') {
//       if (isMobile) {
//         return;
//       } else {
//         if (!e.shiftKey) {
//           e.preventDefault();
//           handleSubmit(e);
//         }
//       }
//     }
//   };

  


//   const validateImageFile = (file: File): boolean => {
//     const maxSize = 20 * 1024 * 1024;
//     if (file.size > maxSize) {
//       alert('Image size must not exceed 20MB');
//       return false;
//     }
//     return true;
//   };

//   const handlePaste = async (e: React.ClipboardEvent) => {
//     const items = e.clipboardData?.items;

//     if (items) {
//       for (let i = 0; i < items.length; i++) {
//         const item = items[i];
//         if (item.type.indexOf('image') !== -1) {
//           e.preventDefault();
//           const file = item.getAsFile();
//           if (file && validateImageFile(file)) {
//             setSelectedImages(prev => [...prev, file]);
//           }
//           break;
//         }
//       }
//     }
//   };

//   const canSubmit = () => {
//     return (
//       !isLoading &&
//       selectedModel &&
//       (inputMessage.trim() || (!isImageGenerationMode && selectedImages.length > 0))
//     );
//   };

//   const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const files = e.target.files;
//     if (files) {
//       const validFiles = Array.from(files).filter(file => validateImageFile(file));
//       setSelectedImages(prev => [...prev, ...validFiles]);
//     }
//     // Reset the input value to allow selecting the same file again
//     e.target.value = '';
//   };

//   const handleRemoveImage = (index: number) => {
//     setSelectedImages(prev => prev.filter((_, i) => i !== index));
//   };

//   const formatMessageTime = (timestamp: MongoDBDate | Date | string | undefined) => {
//     try {
//         // Handle undefined timestamp
//         if (!timestamp) {
//             return 'Just now';
//         }

//         // Convert to Date object based on format
//         let dateObj: Date;
//         if (typeof timestamp === 'string') {
//             dateObj = new Date(timestamp);
//         } else if (timestamp instanceof Date) {
//             dateObj = timestamp;
//         } else if (timestamp.$date) {
//             dateObj = new Date(timestamp.$date);
//         } else {
//             return 'Just now';
//         }

//         // Verify the timestamp is valid
//         if (isNaN(dateObj.getTime())) {
//             return 'Just now';
//         }

//         const now = new Date();
//         const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
//         const diffInMinutes = Math.floor(diffInSeconds / 60);
//         const diffInHours = Math.floor(diffInMinutes / 60);
//         const diffInDays = Math.floor(diffInHours / 24);

//         // If less than 1 minute ago
//         if (diffInSeconds < 60) {
//             return 'Just now';
//         }
//         // If less than 1 hour ago
//         else if (diffInMinutes < 60) {
//             return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
//         }
//         // If less than 24 hours ago
//         else if (diffInHours < 24) {
//             return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
//         }
//         // If less than 7 days ago
//         else if (diffInDays < 7) {
//             return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
//         }
//         // If in the current year
//         else if (dateObj.getFullYear() === now.getFullYear()) {
//             return dateObj.toLocaleString('th-TH', {
//                 month: 'short',
//                 day: '2-digit',
//                 hour: '2-digit',
//                 minute: '2-digit',
//                 hour12: false
//             });
//         }
//         // If older than current year
//         else {
//             return dateObj.toLocaleString('th-TH', {
//                 year: 'numeric',
//                 month: 'short',
//                 day: '2-digit',
//                 hour: '2-digit',
//                 minute: '2-digit',
//                 hour12: false
//             });
//         }
//     } catch (error) {
//         console.error('Error formatting timestamp:', error);
//         return 'Just now';
//     }
//   };

//   const MessageContent: React.FC<{ message: Message }> = ({ message }) => {
//     const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

//     const copyToClipboard = (code: string, index: number) => {
//       navigator.clipboard.writeText(code);
//       setCopiedIndex(index);
//       setTimeout(() => setCopiedIndex(null), 2000);
//     };

//     const renderContent = (content: string) => {
//       const parts = content.split(/(```[\s\S]*?```)/g);

//       return parts.map((part, index) => {
//         if (part.startsWith('```') && part.endsWith('```')) {
//           const [, language = '', code = ''] = part.match(/```(\w*)\n?([\s\S]*?)```/) || [];
//           return (
//             <div key={index} className="my-2 relative">
//               <div className="flex justify-between items-center bg-[#1E1E1E] text-white text-xs px-4 py-2 rounded-t">
//                 <span>{language || 'plaintext'}</span>
//                 <button
//                   onClick={() => copyToClipboard(code.trim(), index)}
//                   className="text-gray-400 hover:text-white"
//                 >
//                   {copiedIndex === index ? 'Copied!' : 'Copy code'}
//                 </button>
//               </div>
//               <SyntaxHighlighter
//                 language={language || 'plaintext'}
//                 style={vscDarkPlus}
//                 customStyle={{
//                   margin: 0,
//                   borderTopLeftRadius: 0,
//                   borderTopRightRadius: 0,
//                 }}
//               >
//                 {code.trim()}
//               </SyntaxHighlighter>
//             </div>
//           );
//         }
//         return <span key={index}>{part}</span>;
//       });
//     };

//     return (
//       <div className="">
//         <div className={`grid gap-2 auto-cols-fr ${
//           message.images && message.images.length > 0 
//             ? `grid-cols-${Math.min(message.images.length, 3)} w-fit`
//             : ''
//         }`}>
//           {message.images?.map((img, index) => (
//             <img
//               key={index}
//               src={`data:${img.mediaType};base64,${img.data}`}
//               alt="Uploaded content"
//               className="max-w-[200px] w-full h-auto rounded-lg object-contain"
//             />
//           ))}
//         </div>
//         <div className="overflow-hidden break-words whitespace-pre-wrap text-sm md:text-base">
//           {renderContent(message.content)}
//         </div>
//       </div>
//     );
//   };

//   // เพิ่ม function สำหรับดึงข้อมูล usage
//   const fetchUsage = async () => {
//     try {
//       const token = localStorage.getItem('auth_token');
//       const response = await fetch(`${config.apiUrl}/api/chat/usage`, {
//         headers: {
//           'Authorization': `Bearer ${token}`
//         }
//       });
//       if (response.ok) {
//         const data = await response.json();
//         setUsage(data);
//       }
//     } catch (error) {
//       console.error('Error fetching usage:', error);
//     }
//   };

//   // เช็ค usage ทุกครั้งที่โหลดหน้า
//   useEffect(() => {
//     const checkAndFetchUsage = async () => {
//       try {
//         const token = localStorage.getItem('auth_token');
//         const response = await fetch(`${config.apiUrl}/api/chat/usage`, {
//           headers: {
//             'Authorization': `Bearer ${token}`
//           }
//         });
//         if (response.ok) {
//           const data = await response.json();
//           setUsage(data);
//         }
//       } catch (error) {
//         console.error('Error fetching usage:', error);
//       }
//     };

//     checkAndFetchUsage();
//   }, []); // เรียกใช้เฉพาะตอน component mount

//   return (
//     <div className="flex flex-col h-[calc(100vh-4rem)]">
//       <div className="flex-1 overflow-y-auto px-4 pb-[calc(180px+env(safe-area-inset-bottom))] pt-4 md:pb-40">
//         {messages.length === 0 ? (
//           <div className="flex flex-col items-center justify-center h-full">
//             <div className="flex flex-col items-center justify-center mb-1">
//               <img
//                 src="/mfu_logo_chatbot.PNG"
//                 alt="MFU Logo"
//                 className="w-24 h-24 mb-2 object-contain"
//               />
//               <div className="text-center">
//                 <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-0">
//                   Welcome to
//                 </h1>
//                 <div className="text-2xl font-bold -mt-1 mb-0">
//                   <span style={{
//                     background: 'linear-gradient(to right, rgb(186, 12, 47), rgb(212, 175, 55))',
//                     WebkitBackgroundClip: 'text',
//                     WebkitTextFillColor: 'transparent',
//                     backgroundClip: 'text'
//                   }}>
//                     MFU
//                   </span>{' '}
//                   <span className="text-gray-800 dark:text-white">Chat{''}</span>
//                   <span style={{
//                     background: 'linear-gradient(to right, #00FFFF, #0099FF)',
//                     WebkitBackgroundClip: 'text',
//                     WebkitTextFillColor: 'transparent',
//                     backgroundClip: 'text'
//                   }}>
//                     AI
//                   </span>
//                 </div>
//               </div>
//             </div>
//             <p className="text-gray-600 dark:text-gray-300 -mt-1">How can I help you today?</p>
//           </div>
//         ) : (
//           <div className="space-y-6">
//             {messages.map((message) => (
//               <div key={message.id} className="message relative">
//                 <div className={`flex items-start gap-3 ${
//                   message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
//                 }`}>
//                   <div className={`flex-shrink-0 w-8 h-8 rounded-full overflow-hidden ${
//                     message.role === 'user'
//                       ? 'bg-gradient-to-r from-red-600 to-yellow-400'
//                       : 'bg-transparent'
//                   } flex items-center justify-center`}>
//                     {message.role === 'user' ? (
//                       <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
//                         <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
//                       </svg>
//                     ) : (
//                       <img
//                         src="/dindin.PNG"
//                         alt="AI Assistant"
//                         className="w-full h-full object-cover"
//                       />
//                     )}
//                   </div>

//                   <div className={`flex flex-col space-y-2 max-w-[80%] ${
//                     message.role === 'user' ? 'items-end' : 'items-start'
//                   }`}>
//                     <div className="text-sm text-gray-500">
//                       {formatMessageTime(message.timestamp)}
//                     </div>
//                     <div className={`rounded-lg p-3 ${
//                       message.role === 'user'
//                         ? 'bg-blue-500 text-white'
//                         : 'bg-gray-200 dark:bg-gray-700 dark:text-white'
//                     }`}>
//                       {message.role === 'assistant' && message.content === '' && isLoading ? (
//                         <LoadingDots />
//                       ) : (
//                         <MessageContent message={message} />
//                       )}
//                     </div>
//                   </div>
//                 </div>

//                 {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
//                   <div className="ml-2 mt-1">
//                     <button
//                       onClick={() => {
//                         const sourceInfo = message.sources?.map(source =>
//                           `Model: ${source.modelId}\n` +
//                           `Collection: ${source.collectionName}\n` +
//                           `File: ${source.filename}\n` +
//                           `Source: ${source.source || 'N/A'}\n` +
//                           `Similarity: ${(source.similarity * 100).toFixed(1)}%`
//                         ).join('\n\n');
//                         alert(sourceInfo);
//                       }}
//                       className="text-xs text-blue-500 hover:text-blue-700 underline flex items-center gap-1"
//                     >
//                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
//                       </svg>
//                       View Sources ({message.sources.length})
//                     </button>
//                   </div>
//                 )}
//               </div>
//             ))}
//             <div ref={messagesEndRef} />
//           </div>
//         )}
//       </div>

//       <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white dark:bg-gray-800 border-t dark:border-gray-700 pb-[env(safe-area-inset-bottom)]">
//         <form onSubmit={handleSubmit} className="p-2 md:p-4">
//           <div className="flex flex-col gap-2 max-w-[95%] lg:max-w-[85%] mx-auto">
//             {/* Message input area */}
//             <div className="flex gap-2 w-full">
//               <textarea
//                 ref={textareaRef}
//                 value={inputMessage}
//                 onChange={(e) => handleInputChange(e)}
//                 onKeyDown={(e) => handleKeyDown(e)}
//                 onPaste={handlePaste}
//                 className="flex-1 min-w-0 p-2 text-sm md:text-base rounded-2xl border border-gray-300 dark:border-gray-600 
//                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 
//                   focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none
//                   scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 
//                   scrollbar-track-transparent hover:scrollbar-thumb-gray-400 
//                   dark:hover:scrollbar-thumb-gray-500 scrollbar-thumb-rounded-full"
//                 style={{
//                   scrollbarWidth: 'thin',
//                   scrollbarColor: 'rgb(209 213 219) transparent'
//                 }}
//                 placeholder={
//                   isImageGenerationMode 
//                     ? "Describe the image you want to generate..." 
//                     : selectedImages.length > 0 
//                       ? "Please describe or ask about these images..." 
//                       : "Type a message..."
//                 }
//                 rows={1}
//                 autoComplete="off"
//                 spellCheck="false"
//                 data-verify="false"
//               />
//               <button
//                 type="submit"
//                 className={`p-2 rounded-full transition-colors flex-shrink-0 ${
//                   canSubmit() ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
//                 }`}
//                 disabled={!canSubmit()}
//                 data-verify="false"
//               >
//                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
//                 </svg>
//               </button>
//             </div>

//             {/* Controls and options */}
//             <div className="flex flex-wrap gap-2 items-center justify-between">
//               {/* Left side controls */}
//               <div className="flex flex-wrap gap-2 items-center">
//                 <div className="relative" ref={dropdownRef}>
//                   <button
//                     type="button"
//                     className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 
//                       hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 min-w-[120px] md:min-w-[180px]"
//                     onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
//                   >
//                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
//                     </svg>
//                     <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300 truncate flex-1 text-left">
//                       {selectedModel ? (models.find(m => m.id === selectedModel)?.name ?? 'Select Model') : 'Select Model'}
//                     </span>
//                   </button>

//                   {isModelDropdownOpen && (
//                     <div 
//                       className="absolute bottom-full left-0 mb-2 p-2 rounded-lg border border-gray-300 dark:border-gray-600 
//                         bg-white dark:bg-gray-700 shadow-lg z-50 max-h-[200px] overflow-y-auto min-w-[200px]"
//                     >
//                       {models.map(model => (
//                         <button
//                           key={model.id}
//                           className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-600
//                             text-gray-900 dark:text-white transition-colors flex items-center gap-2 ${
//                               model.id === selectedModel ? 'bg-blue-100 dark:bg-blue-900' : ''
//                             }`}
//                           onClick={() => {
//                             setSelectedModel(model.id);
//                             setIsModelDropdownOpen(false);
//                           }}
//                         >
//                           <span className="truncate flex-1 font-medium">{model.name}</span>
//                           <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">({model.modelType})</span>
//                         </button>
//                       ))}
//                     </div>
//                   )}
//                 </div>

//                 {!isImageGenerationMode && (
//                   <>
//                     <input
//                       type="file"
//                       id="file-upload"
//                       accept="image/*"
//                       multiple
//                       onChange={handleFileSelect}
//                       className="hidden"
//                     />
//                     <button
//                       type="button"
//                       className="px-3 py-1.5 flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 
//                         hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
//                       onClick={() => {
//                         document.getElementById('file-upload')?.click();
//                       }}
//                     >
//                       <RiImageAddFill className="h-4 w-4 text-gray-600 dark:text-gray-300" />
//                       <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300 hidden md:inline">Add Image</span>
//                     </button>
//                   </>
//                 )}

//                 {usage && (
//                   <div className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600">
//                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4-4-4z" />
//                     </svg>
//                     <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300">
//                       {usage.remainingQuestions}/{usage.dailyLimit}
//                     </span>
//                   </div>
//                 )}
//               </div>
//             </div>

//             {/* Selected Images Preview */}
//             {selectedImages.length > 0 && (
//               <div className="flex flex-wrap gap-2 mt-2">
//                 {selectedImages.map((image, index) => (
//                   <div key={index} className="relative">
//                     <img
//                       src={URL.createObjectURL(image)}
//                       alt={`Selected ${index + 1}`}
//                       className="w-16 h-16 object-cover rounded-lg"
//                     />
//                     <button
//                       type="button"
//                       onClick={() => handleRemoveImage(index)}
//                       className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
//                     >
//                       ×
//                     </button>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// };

// export default MFUChatbot;

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { config } from '../../config/config';
import { RiImageAddFill } from 'react-icons/ri';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { VscDebugContinue } from "react-icons/vsc";

interface Source {
  modelId: string;
  collectionName: string;
  filename: string;
  source?: string;
  similarity: number;
}

interface MongoDBId {
  $oid: string;
}

interface MongoDBDate {
  $date: string;
}

interface Message {
  id: number | string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: { $date: string };
  images?: { data: string; mediaType: string }[];
  sources?: Source[];
  isImageGeneration?: boolean;
  isComplete?: boolean;
}

interface ChatHistory {
  _id: MongoDBId;
  userId: string;
  modelId: string;
  collectionName: string;
  chatname: string;
  messages: Message[];
  updatedAt: MongoDBDate;
  createdAt: MongoDBDate;
  sources: Source[];
  __v: number;
}

interface Model {
  id: string;
  name: string;
  modelType: 'official' | 'personal';
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
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImageGenerationMode, setIsImageGenerationMode] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [usage, setUsage] = useState<{
    dailyQuestions: number;
    dailyLimit: number;
    remainingQuestions: number;
  } | null>(null);

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

        // console.log('Fetching models with token:', `Bearer ${token}`);
        // ดึงโมเดลทั้งหมดจาก API
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
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
            return;
          }
          
          throw new Error(`Failed to fetch models: ${errorText}`);
        }

        const dbModels = await response.json();
        
        // แปลงข้อมูลโมเดลให้อยู่ในรูปแบบที่ต้องการ
        const allModels = dbModels.map((model: any) => ({
          id: model._id,
          name: model.name,
          modelType: model.modelType
        }));

        // console.log('Loaded models:', allModels);
        setModels(allModels);

        // ตั้งค่าโมเดลเริ่มต้น
        if (allModels.length > 0) {
          const defaultModel = allModels.find((model: any) => model.name === 'Default') || allModels[0];
          setSelectedModel(defaultModel.id);
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

  const loadChatHistory = async () => {
    try {
      const urlParams = new URLSearchParams(location.search);
      const chatId = urlParams.get('chat');
      
      // Add validation for MongoDB ObjectId format
      const isValidObjectId = (id: string | null): boolean => {
        if (!id) return false;
        return /^[0-9a-fA-F]{24}$/.test(id);
      };
      
      if (!chatId) {
        // console.log('No chat ID provided, starting new chat');
        return;
      }

      if (!isValidObjectId(chatId)) {
        console.warn(`Invalid chat ID format: ${chatId}, starting new chat`);
        // Remove the invalid chatId from URL
        navigate('/mfuchatbot', { replace: true });
        return;
      }

      const token = localStorage.getItem('auth_token');
      if (!token) {
        // console.log('No authentication token found');
        navigate('/login');
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/chat/chats/${chatId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const chat: ChatHistory = await response.json();
        // console.log('Loaded chat:', chat);
        
        // Convert MongoDB ObjectId to string if necessary
        const chatIdString = typeof chat._id === 'string' ? chat._id : chat._id.$oid;
        setCurrentChatId(chatIdString);
        
        if (chat.modelId) {
          setSelectedModel(chat.modelId);
        }

        if (chat.messages && Array.isArray(chat.messages)) {
          const processedMessages = chat.messages.map((msg) => ({
            ...msg,
            timestamp: msg.timestamp,
            images: msg.images || [],
            sources: msg.sources || [],
            isImageGeneration: msg.isImageGeneration || false,
            isComplete: true
          }));
          setMessages(processedMessages);
        }
      } else {
        const errorData = await response.text();
        console.error('Failed to load chat:', errorData);
        // Remove the invalid chatId from URL
        navigate('/mfuchatbot', { replace: true });
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      // Remove the invalid chatId from URL
      navigate('/mfuchatbot', { replace: true });
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const chatId = urlParams.get('chat');

    if (chatId) {
      loadChatHistory();
    } else {
      // Reset state for new chat but keep selected model
      setMessages([]);
      setCurrentChatId(null);
      setInputMessage('');
      setSelectedImages([]);
      setIsImageGenerationMode(false);
      
      // If no model is selected, set default model
      if (!selectedModel && models.length > 0) {
        const defaultModel = models.find(model => model.name === 'Default');
        setSelectedModel(defaultModel?.id || models[0].id);
      }
    }
  }, [location.search, models]);

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
    if (!inputMessage.trim() && !isImageGenerationMode) return;
    if (!selectedModel) {
      alert('Please select a model first');
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token || !wsRef.current) {
        throw new Error('Not authenticated or WebSocket not connected');
      }

      const userMessage: Message = {
        id: messages.length + 1,
        role: 'user',
        content: inputMessage.trim(),
        timestamp: {
          $date: new Date().toISOString()
        },
        images: !isImageGenerationMode && selectedImages.length > 0 ? 
          await Promise.all(selectedImages.map(async (file) => await compressImage(file))) 
          : [],
        sources: [],
        isImageGeneration: isImageGenerationMode
      };

      // Add user message to state
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      // Add placeholder for AI response
      const assistantMessage: Message = {
        id: messages.length + 2,
        role: 'assistant',
        content: '',
        timestamp: {
          $date: new Date().toISOString()
        },
        images: [],
        sources: [],
        isImageGeneration: isImageGenerationMode,
        isComplete: false
      };
      setMessages([...updatedMessages, assistantMessage]);

      // Send message to WebSocket
      const messagePayload = {
        messages: updatedMessages,
        modelId: selectedModel,
        isImageGeneration: isImageGenerationMode,
        path: location.pathname,
        chatId: currentChatId
      };

      wsRef.current?.send(JSON.stringify(messagePayload));

      // อัพเดท usage ทันทีหลังส่งข้อความ
      await fetchUsage();

    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setMessages(prev => [...prev.slice(0, -1), {
        id: messages.length + 2,
        role: 'assistant',
        content: error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred',
        timestamp: {
          $date: new Date().toISOString()
        },
        images: [],
        sources: [],
        isImageGeneration: false,
        isComplete: true
      }]);
    } finally {
      setIsLoading(false);
      setInputMessage('');
      setSelectedImages([]);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const wsUrl = new URL(import.meta.env.VITE_WS_URL);
    wsUrl.searchParams.append('token', token);
    
    // Add validation for MongoDB ObjectId format
    const isValidObjectId = (id: string | null): boolean => {
      if (!id) return false;
      return /^[0-9a-fA-F]{24}$/.test(id);
    };
    
    // Only append chatId if it's a valid ObjectId
    if (currentChatId && isValidObjectId(currentChatId)) {
      // console.log('Adding valid chatId to WebSocket URL:', currentChatId);
      wsUrl.searchParams.append('chat', currentChatId);
    } else {
      // console.log('No valid chatId to add to WebSocket URL');
    }
    
    wsRef.current = new WebSocket(wsUrl.toString());

    wsRef.current.onopen = () => {
      // console.log('WebSocket connection established');
    };

    wsRef.current.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.error) {
          console.error('Received error from WebSocket:', data.error);
          setMessages(prev => prev.map((msg, index) => 
            index === prev.length - 1 && msg.role === 'assistant' ? {
              ...msg,
              content: `Error: ${data.error}`,
              isComplete: true
            } : msg
          ));
          return;
        }

        // Handle different message types
        switch (data.type) {
          case 'chat_created':
            // Just store the chatId, don't update URL yet
            setCurrentChatId(data.chatId);
            break;

          case 'content':
            setMessages(prev => prev.map((msg, index) => 
              index === prev.length - 1 && msg.role === 'assistant' ? {
                ...msg,
                content: msg.content + data.content
              } : msg
            ));
            break;

          case 'complete':
            setMessages(prev => {
              const updatedMessages = prev.map((msg, index) => 
                index === prev.length - 1 && msg.role === 'assistant' ? {
                  ...msg,
                  sources: data.sources || [],
                  isComplete: true
                } : msg
              );
              return updatedMessages;
            });
            
            // Now that the response is complete, update URL with chatId
            if (data.chatId) {
              setCurrentChatId(data.chatId);
              navigate(`/mfuchatbot?chat=${data.chatId}`, { replace: true });
              window.dispatchEvent(new CustomEvent('chatUpdated'));
            }
            break;

          case 'chat_updated':
            if (data.shouldUpdateList) {
              window.dispatchEvent(new CustomEvent('chatHistoryUpdated'));
            }
            break;

          case 'error':
            console.error('Error from server:', data.error);
            setMessages(prev => prev.map((msg, index) => 
              index === prev.length - 1 && msg.role === 'assistant' ? {
                ...msg,
                content: `Error: ${data.error}`,
                isComplete: true
              } : msg
            ));
            break;
        }

        // อัพเดท usage หลังจากได้รับข้อความ
        if (data.type === 'complete') {
          await fetchUsage();
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        setMessages(prev => prev.map((msg, index) => 
          index === prev.length - 1 && msg.role === 'assistant' ? {
            ...msg,
            content: 'Error processing response. Please try again.',
            isComplete: true
          } : msg
        ));
      }
    };

    wsRef.current.onclose = () => {
      // console.log('WebSocket connection closed');
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [navigate]);

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
      (inputMessage.trim() || (!isImageGenerationMode && selectedImages.length > 0))
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const validFiles = Array.from(files).filter(file => validateImageFile(file));
      setSelectedImages(prev => [...prev, ...validFiles]);
    }
    // Reset the input value to allow selecting the same file again
    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const formatMessageTime = (timestamp: MongoDBDate | Date | string | undefined) => {
    try {
        // Handle undefined timestamp
        if (!timestamp) {
            return 'Just now';
        }

        // Convert to Date object based on format
        let dateObj: Date;
        if (typeof timestamp === 'string') {
            dateObj = new Date(timestamp);
        } else if (timestamp instanceof Date) {
            dateObj = timestamp;
        } else if (timestamp.$date) {
            dateObj = new Date(timestamp.$date);
        } else {
            return 'Just now';
        }

        // Verify the timestamp is valid
        if (isNaN(dateObj.getTime())) {
            return 'Just now';
        }

        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        // If less than 1 minute ago
        if (diffInSeconds < 60) {
            return 'Just now';
        }
        // If less than 1 hour ago
        else if (diffInMinutes < 60) {
            return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
        }
        // If less than 24 hours ago
        else if (diffInHours < 24) {
            return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
        }
        // If less than 7 days ago
        else if (diffInDays < 7) {
            return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
        }
        // If in the current year
        else if (dateObj.getFullYear() === now.getFullYear()) {
            return dateObj.toLocaleString('th-TH', {
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }
        // If older than current year
        else {
            return dateObj.toLocaleString('th-TH', {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }
    } catch (error) {
        console.error('Error formatting timestamp:', error);
        return 'Just now';
    }
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

  // เพิ่ม function สำหรับดึงข้อมูล usage
  const fetchUsage = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/usage`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsage(data);
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    }
  };

  // เรียกใช้ตอน component mount และหลังจากส่งข้อความ
  // เช็ค usage ทุกครั้งที่โหลดหน้า
  useEffect(() => {
    const checkAndFetchUsage = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${config.apiUrl}/api/chat/usage`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setUsage(data);
        }
      } catch (error) {
        console.error('Error fetching usage:', error);
      }
    };

    checkAndFetchUsage();
  }, []); // เรียกใช้เฉพาะตอน component mount

  // Function to handle continue button click
  const handleContinueClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedModel) {
      alert('Please select a model first');
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token || !wsRef.current) {
        throw new Error('Not authenticated or WebSocket not connected');
      }

      // Creating a temporary message that won't be displayed
      const continueMessage: Message = {
        id: messages.length + 1,
        role: 'user',
        content: "Continue writing",
        timestamp: {
          $date: new Date().toISOString()
        },
        images: [],
        sources: [],
        isImageGeneration: false
      };

      // Add placeholder for AI response without showing the user message
      const assistantMessage: Message = {
        id: messages.length + 2,
        role: 'assistant',
        content: '',
        timestamp: {
          $date: new Date().toISOString()
        },
        images: [],
        sources: [],
        isImageGeneration: false,
        isComplete: false
      };
      
      // Only add the assistant message to the UI
      setMessages([...messages, assistantMessage]);

      // Send message to WebSocket with both messages
      const messagePayload = {
        messages: [...messages, continueMessage],
        modelId: selectedModel,
        isImageGeneration: false,
        path: location.pathname,
        chatId: currentChatId
      };

      wsRef.current?.send(JSON.stringify(messagePayload));

      // Update usage after sending the message
      fetchUsage();

    } catch (error) {
      console.error('Error in handleContinueClick:', error);
      setMessages(prev => [...prev.slice(0, -1), {
        id: messages.length + 2,
        role: 'assistant',
        content: error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred',
        timestamp: {
          $date: new Date().toISOString()
        },
        images: [],
        sources: [],
        isImageGeneration: false,
        isComplete: true
      }]);
    } finally {
      setIsLoading(false);
    }
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
                      {formatMessageTime(message.timestamp)}
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

                {/* Add Continue button after the last assistant message */}
                {message.role === 'assistant' && message.isComplete && message === messages[messages.length - 1] && (
                  <div className="ml-11 mt-2">
                    <button
                      type="button"
                      onClick={handleContinueClick}
                      className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 text-sm ${
                        selectedModel ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      disabled={!selectedModel}
                      title="Continue writing"
                      data-verify="false"
                    >
                      <VscDebugContinue className="h-4 w-4" />
                      <span>Continue</span>
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
          <div className="flex flex-col gap-2 max-w-[95%] lg:max-w-[85%] mx-auto">
            {/* Message input area */}
            <div className="flex gap-2 w-full">
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
                autoComplete="off"
                spellCheck="false"
                data-verify="false"
              />
              <button
                type="submit"
                className={`p-2 rounded-full transition-colors flex-shrink-0 ${
                  canSubmit() ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                disabled={!canSubmit()}
                data-verify="false"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>

            {/* Controls and options */}
            <div className="flex flex-wrap gap-2 items-center justify-between">
              {/* Left side controls */}
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 
                      hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 min-w-[120px] md:min-w-[180px]"
                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300 truncate flex-1 text-left">
                      {selectedModel ? (models.find(m => m.id === selectedModel)?.name ?? 'Select Model') : 'Select Model'}
                    </span>
                  </button>

                  {isModelDropdownOpen && (
                    <div 
                      className="absolute bottom-full left-0 mb-2 p-2 rounded-lg border border-gray-300 dark:border-gray-600 
                        bg-white dark:bg-gray-700 shadow-lg z-50 max-h-[200px] overflow-y-auto min-w-[200px]"
                    >
                      {models.map(model => (
                        <button
                          key={model.id}
                          className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-600
                            text-gray-900 dark:text-white transition-colors flex items-center gap-2 ${
                              model.id === selectedModel ? 'bg-blue-100 dark:bg-blue-900' : ''
                            }`}
                          onClick={() => {
                            setSelectedModel(model.id);
                            setIsModelDropdownOpen(false);
                          }}
                        >
                          <span className="truncate flex-1 font-medium">{model.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">({model.modelType})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {!isImageGenerationMode && (
                  <>
                    <input
                      type="file"
                      id="file-upload"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      className="px-3 py-1.5 flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 
                        hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                      onClick={() => {
                        document.getElementById('file-upload')?.click();
                      }}
                    >
                      <RiImageAddFill className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                      <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300 hidden md:inline">Add Image</span>
                    </button>
                  </>
                )}

                {usage && (
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4-4-4z" />
                    </svg>
                    <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300">
                      {usage.remainingQuestions}/{usage.dailyLimit}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Selected Images Preview */}
            {selectedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedImages.map((image, index) => (
                  <div key={index} className="relative">
                    <img
                      src={URL.createObjectURL(image)}
                      alt={`Selected ${index + 1}`}
                      className="w-16 h-16 object-cover rounded-lg"
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
          </div>
        </form>
      </div>
    </div>
  );
};

export default MFUChatbot;