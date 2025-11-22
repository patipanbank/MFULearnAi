import React, { useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChatStore, useAgentStore, useUIStore, useAuthStore } from '../../shared/stores';
import type { ChatMessage } from '../../shared/stores/chatStore';
import type { AgentConfig } from '../../shared/stores/agentStore';
import ResponsiveChatInput from '../../shared/ui/ResponsiveChatInput';
import Loading from '../../shared/ui/Loading';
import { api } from '../../shared/lib/api';
import { useWebSocket } from '../../shared/hooks/useWebSocket';
import { useChatNavigation } from '../../shared/hooks/useChatNavigation';
import { useChatInput } from '../../shared/hooks/useChatInput';
import { useMessageActions } from './hooks/useMessageActions';
import { useFileUpload } from './hooks/useFileUpload';
import ChatMessages from './components/ChatMessages';
import WelcomeScreen from './components/WelcomeScreen';

const ChatPage: React.FC = () => {
  console.log('ChatPage: Component rendering');
  
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  const currentSession = useChatStore((state) => state.currentSession);
  const setCurrentSession = useChatStore((state) => state.setCurrentSession);
  const addMessage = useChatStore((state) => state.addMessage);
  const wsStatus = useChatStore((state) => state.wsStatus);
  const isTyping = useChatStore((state) => state.isTyping);
  const setIsTyping = useChatStore((state) => state.setIsTyping);
  const setChatHistory = useChatStore((state) => state.setChatHistory);
  const isLoading = useChatStore((state) => state.isLoading);
  const setIsLoading = useChatStore((state) => state.setIsLoading);
  
  // Force loading to false on mount
  useEffect(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  const selectedAgent = useAgentStore((state) => state.selectedAgent);
  const fetchAgents = useAgentStore((state) => state.fetchAgents);

  const setLoading = useUIStore((state) => state.setLoading);
  const addToast = useUIStore((state) => state.addToast);

  // Navigation
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId?: string }>();

  // Determine if we're in a specific chat room
  const isInChatRoom = Boolean(chatId);
  const hasMessages = (currentSession?.messages.length || 0) > 0;

  // Custom hooks
  const {
    wsRef,
    pendingFirstRef,
    pendingQueueRef,
    connectWebSocket,
    isTokenExpired,
    tryRefreshToken,
    sendMessage: wsSendMessage
  } = useWebSocket({ chatId, isInChatRoom });

  // Chat navigation is handled by useChatNavigation hook
  useChatNavigation({ chatId, isInChatRoom, connectWebSocket });

  const {
    message,
    setMessage,
    images,
    setImages,
    messagesEndRef
  } = useChatInput();

  // Custom hooks for extracted functionality
  const {
    activeMessageMenu,
    editingMessage,
    editingContent,
    handleCopyMessage,
    handleEditMessage,
    handleSaveEdit,
    handleCancelEdit,
    handleDeleteMessage,
    setActiveMessageMenu,
    setEditingContent
  } = useMessageActions();

  const {
    files,
    handleFileUpload,
    handleRemoveFile
  } = useFileUpload();

  // Debug function to test WebSocket connection
  const debugWebSocket = useCallback(() => {
    console.log('=== WebSocket Debug Info ===');
    console.log('WebSocket ref:', wsRef.current);
    console.log('WebSocket readyState:', wsRef.current?.readyState);
    console.log('Is in chat room:', isInChatRoom);
    console.log('Chat ID:', chatId);
    console.log('Current session:', currentSession);
    console.log('Selected agent:', selectedAgent);
    console.log('Pending queue:', pendingQueueRef.current);
    console.log('Pending first:', pendingFirstRef.current);
    console.log('===========================');
  }, [wsRef, isInChatRoom, chatId, currentSession, selectedAgent, pendingQueueRef, pendingFirstRef]);

  // Initialize data on mount - Create dummy chat with sample messages
  useEffect(() => {
    const initializeData = async () => {
      console.log('ChatPage: Initializing dummy chat...');
      
      // Check if dummy session already exists
      const existingSession = useChatStore.getState().currentSession;
      if (existingSession && existingSession.id === 'dummy-chat-001' && existingSession.messages.length > 0) {
        console.log('ChatPage: Dummy session already exists, skipping initialization');
        setIsLoading(false);
        return;
      }
      
      // Create dummy session with more sample messages
      const now = Date.now();
      const dummySession = {
        id: 'dummy-chat-001',
        name: 'บทสนทนาดัมมี่',
        messages: [
          {
            id: 'msg-1',
            role: 'user' as const,
            content: 'สวัสดีครับ ผมต้องการความช่วยเหลือเกี่ยวกับการเขียนโปรแกรม',
            timestamp: new Date(now - 3600000), // 1 hour ago
          },
          {
            id: 'msg-2',
            role: 'assistant' as const,
            content: 'สวัสดีครับ! ยินดีให้ความช่วยเหลือครับ คุณต้องการความช่วยเหลือเกี่ยวกับการเขียนโปรแกรมในเรื่องใดเป็นพิเศษครับ? เช่น การเรียนรู้ภาษาโปรแกรมใหม่, การแก้ไขปัญหา, หรือการออกแบบโครงสร้างโปรแกรม?',
            timestamp: new Date(now - 3550000), // 55 minutes ago
          },
          {
            id: 'msg-3',
            role: 'user' as const,
            content: 'ผมอยากเรียนรู้ React ครับ มีคำแนะนำไหมครับ?',
            timestamp: new Date(now - 3500000), // 50 minutes ago
          },
          {
            id: 'msg-4',
            role: 'assistant' as const,
            content: 'เยี่ยมเลยครับ! React เป็น JavaScript library ที่ยอดเยี่ยมสำหรับการสร้าง user interface ครับ\n\n**คำแนะนำสำหรับผู้เริ่มต้น:**\n\n1. **เริ่มจากพื้นฐาน JavaScript/ES6** - ควรเข้าใจ concepts เช่น arrow functions, destructuring, spread operator\n\n2. **เรียนรู้ React Fundamentals**\n   - Components (Functional & Class)\n   - Props และ State\n   - JSX syntax\n   - Event handling\n\n3. **ฝึกฝนด้วยโปรเจคเล็กๆ** - สร้าง Todo app, Calculator, หรือ Weather app\n\n4. **เรียนรู้ Hooks** - useState, useEffect, useContext เป็นต้น\n\n5. **ศึกษา State Management** - Context API หรือ Redux\n\nคุณต้องการให้ผมแนะนำแหล่งเรียนรู้ออนไลน์หรือมีคำถามเฉพาะเจาะจงไหมครับ?',
            timestamp: new Date(now - 3450000), // 45 minutes ago
          },
          {
            id: 'msg-5',
            role: 'user' as const,
            content: 'ขอบคุณมากครับ! มีตัวอย่างโค้ด React แบบง่ายๆ ไหมครับ?',
            timestamp: new Date(now - 3400000), // 40 minutes ago
          },
          {
            id: 'msg-6',
            role: 'assistant' as const,
            content: 'ได้เลยครับ! นี่คือตัวอย่าง React component แบบง่ายๆ:\n\n```jsx\nimport React, { useState } from \'react\';\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div>\n      <h1>Count: {count}</h1>\n      <button onClick={() => setCount(count + 1)}>\n        เพิ่ม\n      </button>\n      <button onClick={() => setCount(count - 1)}>\n        ลด\n      </button>\n    </div>\n  );\n}\n\nexport default Counter;\n```\n\nนี่คือตัวอย่าง Counter component ที่ใช้ `useState` hook ครับ:\n- `useState(0)` สร้าง state ชื่อ `count` เริ่มต้นที่ 0\n- `setCount` ใช้สำหรับอัปเดตค่า count\n- เมื่อคลิกปุ่ม ค่าจะเพิ่มหรือลดตามที่กำหนด\n\nลองรันดูครับ!',
            timestamp: new Date(now - 3350000), // 35 minutes ago
          },
          {
            id: 'msg-7',
            role: 'user' as const,
            content: 'เข้าใจแล้วครับ! แล้ว TypeScript กับ React ใช้ร่วมกันได้ไหมครับ?',
            timestamp: new Date(now - 3300000), // 30 minutes ago
          },
          {
            id: 'msg-8',
            role: 'assistant' as const,
            content: 'ใช้ได้เลยครับ! TypeScript กับ React ทำงานร่วมกันได้ดีมากครับ TypeScript จะช่วยให้โค้ดของคุณปลอดภัยและดูแลง่ายขึ้น\n\n**ข้อดีของการใช้ TypeScript กับ React:**\n\n1. **Type Safety** - ตรวจสอบ type ของ props และ state\n2. **IntelliSense** - IDE จะแนะนำโค้ดได้ดีขึ้น\n3. **Error Detection** - จับ error ก่อน runtime\n4. **Better Refactoring** - refactor โค้ดได้ง่ายขึ้น\n\n**ตัวอย่างการใช้งาน:**\n\n```tsx\ninterface Props {\n  name: string;\n  age: number;\n}\n\nconst UserCard: React.FC<Props> = ({ name, age }) => {\n  return (\n    <div>\n      <h2>{name}</h2>\n      <p>Age: {age}</p>\n    </div>\n  );\n};\n```\n\nคุณสามารถเริ่มต้นด้วย `create-react-app` หรือ `Vite` พร้อม TypeScript template ได้เลยครับ!',
            timestamp: new Date(now - 3250000), // 25 minutes ago
          },
          {
            id: 'msg-9',
            role: 'user' as const,
            content: 'ขอบคุณมากครับ! มีคำถามอีกนิดนึงครับ เรื่อง CSS ใน React ควรใช้วิธีไหนดีครับ?',
            timestamp: new Date(now - 3200000), // 20 minutes ago
          },
          {
            id: 'msg-10',
            role: 'assistant' as const,
            content: 'ดีมากครับ! สำหรับ CSS ใน React มีหลายวิธีให้เลือกครับ:\n\n**1. CSS Modules**\n- Scoped styles, ไม่ชนกับ class อื่น\n- ใช้ได้ทันที ไม่ต้องติดตั้งเพิ่ม\n\n**2. Styled Components**\n- CSS-in-JS\n- Dynamic styling\n- Component-based\n\n**3. Tailwind CSS** (แนะนำ!)\n- Utility-first CSS\n- เขียนเร็วมาก\n- Responsive design ง่าย\n\n**4. CSS-in-JS Libraries**\n- Emotion, Styled-components\n- Dynamic styles\n\n**5. Traditional CSS**\n- Global styles\n- ง่ายแต่ต้องระวัง naming conflicts\n\nสำหรับโปรเจคใหม่ ผมแนะนำ **Tailwind CSS** ครับ เพราะเขียนเร็วและ maintain ง่ายมาก!',
            timestamp: new Date(now - 3150000), // 15 minutes ago
          },
          {
            id: 'msg-11',
            role: 'user' as const,
            content: 'เข้าใจแล้วครับ ขอบคุณมากสำหรับคำแนะนำทั้งหมด!',
            timestamp: new Date(now - 3100000), // 10 minutes ago
          },
          {
            id: 'msg-12',
            role: 'assistant' as const,
            content: 'ยินดีครับ! ถ้ามีคำถามเพิ่มเติมเกี่ยวกับ React, TypeScript, หรือการพัฒนาเว็บแอปพลิเคชัน ติดต่อมาได้เลยครับ ผมพร้อมช่วยเหลือเสมอ 😊\n\n**เคล็ดลับสุดท้าย:**\n- ฝึกฝนบ่อยๆ ด้วยการสร้างโปรเจคจริง\n- อ่าน documentation เป็นประจำ\n- เข้าร่วม community เช่น React Thailand\n- อย่ากลัวที่จะลองผิดลองถูก!\n\nขอให้สนุกกับการเขียนโค้ดครับ! 🚀',
            timestamp: new Date(now - 3050000), // 5 minutes ago
          },
        ],
        agentId: 'dummy-agent',
        createdAt: new Date(now - 3600000),
        updatedAt: new Date(),
      };
      
      // Set dummy session
      setCurrentSession(dummySession);
      
      // Create dummy agent instead of fetching from API
      const dummyAgent: AgentConfig = {
        id: 'dummy-agent-001',
        name: 'Dummy AI Assistant',
        description: 'AI Assistant สำหรับทดสอบ',
        systemPrompt: 'You are a helpful AI assistant.',
        modelId: 'dummy-model',
        collectionNames: [],
        tools: [],
        temperature: 0.7,
        maxTokens: 2000,
        permission: 'PUBLIC',
        isPublic: true,
        tags: ['dummy', 'test'],
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
        rating: 5,
      };
      
      // Set dummy agent directly in store
      useAgentStore.setState({
        agents: [dummyAgent],
        selectedAgent: dummyAgent,
        isLoadingAgents: false,
      });
      
      console.log('ChatPage: Dummy agent created');
      // Set loading to false
      setIsLoading(false);
    };
    initializeData();
  }, [setCurrentSession, setIsLoading]);

  // Auto-reconnect when disconnected (but only if token is still valid)
  useEffect(() => {
    let reconnectTimer: number;

    const handleReconnect = async () => {
      if (wsStatus === 'disconnected' && token && currentSession && isInChatRoom) {
        // Check if token is still valid before attempting reconnect
        if (isTokenExpired(token)) {
          console.log('Token expired, attempting refresh...');
          const refreshSuccess = await tryRefreshToken();
          if (!refreshSuccess) {
            addToast({
              type: 'warning',
              title: 'Session Expired',
              message: 'Your session has expired. Please log in again to continue chatting.',
              duration: 0
            });
            return;
          }
        }

        // Try to reconnect after 3 seconds
        reconnectTimer = window.setTimeout(() => {
          console.log('Attempting to reconnect...');
          connectWebSocket();
        }, 3000);
      }
    };

    handleReconnect();

    return () => {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [wsStatus, token, currentSession, isInChatRoom, isTokenExpired, addToast, connectWebSocket, tryRefreshToken]);

  // Handle room creation (when first message is sent)
  const handleRoomCreatedWithNavigate = useCallback((roomId: string) => {
    console.log('Room created, navigating to:', `/chat/${roomId}`);
    // ใช้ navigate function โดยตรง
    navigate(`/chat/${roomId}`);
  }, [navigate]);

  // Send message function - Dummy mode: just add messages locally
  const sendMessage = useCallback(async () => {
    if (!message.trim() && images.length === 0) {
      return;
    }

    console.log('ChatPage: Dummy mode - adding message locally');

    // Clear input
    const messageToSend = message.trim();
    setMessage('');
    setImages([]);

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
    };
    addMessage(userMessage);

    // Show typing indicator
    setIsTyping(true);

    // Simulate AI response after 1-2 seconds
    setTimeout(() => {
      setIsTyping(false);
      
      // Generate dummy AI response
      const dummyResponses = [
        'น่าสนใจมากครับ! คุณต้องการให้ผมช่วยอะไรเพิ่มเติมไหมครับ?',
        'เข้าใจแล้วครับ มีคำถามอื่นอีกไหมครับ?',
        'ดีมากครับ! ผมพร้อมช่วยเหลือคุณเสมอครับ 😊',
        'ขอบคุณสำหรับคำถามครับ! ถ้ามีอะไรเพิ่มเติมบอกได้เลยครับ',
        'ยินดีให้ความช่วยเหลือครับ! มีอะไรอื่นที่อยากรู้เพิ่มเติมไหมครับ?',
        'เข้าใจแล้วครับ! ถ้ามีคำถามอื่นๆ ติดต่อมาได้เลยครับ',
        'ดีมากครับ! ผมหวังว่าคำตอบจะช่วยคุณได้นะครับ',
        'ขอบคุณที่ถามครับ! มีอะไรอื่นที่ต้องการความช่วยเหลือไหมครับ?',
      ];
      
      const randomResponse = dummyResponses[Math.floor(Math.random() * dummyResponses.length)];
      
      const aiMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: randomResponse,
        timestamp: new Date(),
      };
      addMessage(aiMessage);
    }, 1000 + Math.random() * 1000); // Random delay between 1-2 seconds
  }, [message, images, setMessage, setImages, addMessage, setIsTyping]);

  // Handle image upload
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🖼️ Image upload triggered:', {
      filesCount: event.target.files?.length || 0,
      selectedAgent: selectedAgent?.name,
      agentModel: selectedAgent?.modelId,
      isVisionCapable: selectedAgent?.modelId?.includes('claude-3'),
      disabled: !selectedAgent || isLoading,
      isTyping: isTyping
    });

    const files = event.target.files;
    if (!files || files.length === 0) {
      console.log('⚠️ No files selected');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size > maxSize) {
        addToast({
          type: 'error',
          title: 'File Too Large',
          message: `${file.name} is too large. Maximum size is 5MB.`
        });
        continue;
      }

      if (!allowedTypes.includes(file.type)) {
        addToast({
          type: 'error',
          title: 'Invalid File Type',
          message: `${file.name} is not a supported image type.`
        });
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post<{ url: string; mediaType: string }>('/upload/image', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        console.log('🖼️ Upload response:', response);
        setImages(prev => [...prev, { url: response.url, mediaType: response.mediaType || file.type }]);
      } catch (error) {
        console.error('Failed to upload image:', error);
        addToast({
          type: 'error',
          title: 'Upload Failed',
          message: `Failed to upload ${file.name}`
        });
      }
    }

    // File input will be reset by ResponsiveChatInput component
  }, [addToast, setImages]);

  // Handle remove image
  const handleRemoveImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  }, [setImages]);

  // Get user initials for avatar
  const getInitials = useCallback(() => {
    // Return dummy initials for demo
    return 'U';
  }, []);

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = () => {
      if (activeMessageMenu) {
        setActiveMessageMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMessageMenu]);

  // Auth bypassed - no user check needed
  // Always show chat, don't check isLoading
  
  console.log('ChatPage: About to render, isLoading:', isLoading, 'hasMessages:', hasMessages, 'currentSession:', currentSession?.id);

  return (
    <div className="flex h-full bg-primary relative">
      {/* Add a subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="w-full h-full" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(186,12,47) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}/>
      </div>

      {/* Chat Area - Full width */}
      <div className="flex-1 flex flex-col w-full relative h-full overflow-hidden">
        {/* Messages */}
        {hasMessages ? (
          <ChatMessages
            messages={currentSession?.messages || []}
            onCopyMessage={handleCopyMessage}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            editingMessage={editingMessage}
            editingContent={editingContent}
            onEditingContentChange={setEditingContent}
            activeMessageMenu={activeMessageMenu}
            onSetActiveMessageMenu={setActiveMessageMenu}
            getInitials={getInitials}
            messagesEndRef={messagesEndRef}
            isTyping={isTyping}
          />
        ) : (
          <WelcomeScreen userName="คุณ" />
        )}

        {/* Input Area - Fixed at Bottom */}
        <div 
          className="absolute bottom-0 left-0 right-0 pt-6"
          style={{
            background: 'linear-gradient(to top, rgb(var(--color-background)) 0%, rgb(var(--color-background) / 0.95) 20%, rgb(var(--color-background) / 0.5) 60%, transparent 100%)'
          }}
        >
          <div className="px-4 pb-6">
            {/* Debug button - only show in development */}
            {import.meta.env.DEV && (
              <button
                onClick={debugWebSocket}
                className="mb-2 px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
              >
                Debug WebSocket
              </button>
            )}
            <ResponsiveChatInput
              message={message}
              onMessageChange={setMessage}
              onSendMessage={sendMessage}
              onImageUpload={handleImageUpload}
              onFileUpload={handleFileUpload}
              images={images}
              files={files}
              onRemoveImage={handleRemoveImage}
              onRemoveFile={handleRemoveFile}
              disabled={!selectedAgent || isLoading}
              isTyping={isTyping}
              hasMessages={hasMessages}
              isInChatRoom={isInChatRoom}
              onRoomCreated={handleRoomCreatedWithNavigate}
              selectedAgent={selectedAgent}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;