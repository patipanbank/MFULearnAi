import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import WelcomeMessage from '../chat/ui/WelcomeMessage';
import ChatBubble from '../chat/ui/ChatBubble';
import ChatInput from '../chat/ui/ChatInput';
import { useChatStore } from '../chat/store/chatStore';
import { useModelStore } from '../chat/store/modelStore';
import { useUIStore } from '../chat/store/uiStore';
import { useScrollStore } from '../chat/store/scrollStore';
import { isValidObjectId } from '../chat/utils/formatters';

const MFUChatbot: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Refs สำหรับการ scroll
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  
  // Chat state from Zustand
  const {
    messages,
    currentChatId,
    selectedImages,
    selectedFiles,
    editingMessage,
    setCurrentChatId,
    initWebSocket,
    loadChatHistory,
    handleSubmit,
    handleKeyDown,
    handlePaste,
    handleContinueClick,
    handleCancelGeneration,
    handleEditMessage,
    handleRegenerateMessage,
    handleFileSelect,
    handleRemoveImage,
    handleRemoveFile,
    canSubmit
  } = useChatStore();
  
  // UI state from Zustand
  const {
    isLoading,
    isImageGenerationMode,
    isMobile,
    inputMessage,
    setInputMessage,
    setIsImageGenerationMode,
    setMessageCount,
  } = useUIStore();
  
  // Scroll state from Zustand
  const {
    showScrollButton,
    setScrollRefs,
    initScrollObserver,
    handleScrollButtonClick,
    handleNewMessage,
    handleMessageComplete,
    updateScrollPosition
  } = useScrollStore();
  
  // Model state from Zustand
  const {
    models,
    selectedModel,
    usage,
    setSelectedModel,
    fetchUsage,
    fetchModels
  } = useModelStore();
  
  // เซ็ต refs สำหรับการ scroll
  useEffect(() => {
    setScrollRefs(containerRef, endRef);
  }, [setScrollRefs]);
  
  // ตั้งค่า scroll observer
  useEffect(() => {
    const cleanup = initScrollObserver();
    return cleanup;
  }, [initScrollObserver]);
  
  // อัปเดตจำนวนข้อความเมื่อมีการเปลี่ยนแปลง
  useEffect(() => {
    setMessageCount(messages.length);
  }, [messages, setMessageCount]);
  
  // ทำการ auto-scroll เมื่อมีข้อความใหม่หรือสถานะโหลดเปลี่ยนแปลง
  useEffect(() => {
    console.log('Messages updated, handling scroll position', { count: messages.length });
    
    // รอให้ DOM อัพเดตก่อนตรวจสอบตำแหน่ง scroll
    const timer = setTimeout(() => {
      // อัพเดตสถานะ scroll หลังจากเนื้อหาโหลดเสร็จ
      updateScrollPosition();
      // แจ้ง scroll store ว่ามีข้อความใหม่
      handleNewMessage();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [messages, handleNewMessage, updateScrollPosition]);
  
  // จัดการเมื่อการโหลดเสร็จสิ้น
  useEffect(() => {
    if (!isLoading) {
      console.log('Message loading completed');
      
      // รอให้ DOM อัพเดตก่อนตรวจสอบตำแหน่ง scroll
      setTimeout(() => {
        updateScrollPosition();
        handleMessageComplete();
      }, 100);
    }
  }, [isLoading, handleMessageComplete, updateScrollPosition]);
  
  // Initialize WebSocket when component mounts
  useEffect(() => {
    initWebSocket();
  }, [initWebSocket]);
  
  // Fetch models when component mounts
  useEffect(() => {
    console.log('Fetching models...');
    fetchModels();
  }, [fetchModels]);
  
  // Only update URL when response is complete - not during streaming
  useEffect(() => {
    const handleChatUpdated = (event: CustomEvent) => {
      const { chatId, complete } = event.detail || {};
      // Only update URL when response is complete
      if (chatId && complete) {
        navigate(`/mfuchatbot?chat=${chatId}`, { replace: true });
      } else if (chatId && chatId !== currentChatId) {
        // Just update the internal state without navigation
        setCurrentChatId(chatId);
      }
    };
    
    // Handle the early URL updates from WebSocket messages
    const handleChatUrlUpdated = (event: CustomEvent) => {
      const { chatId, early } = event.detail || {};
      if (chatId && early && chatId !== currentChatId) {
        console.log('URL updated early for chatId:', chatId);
        setCurrentChatId(chatId);
      }
    };
    
    window.addEventListener('chatUpdated', handleChatUpdated as EventListener);
    window.addEventListener('chatUrlUpdated', handleChatUrlUpdated as EventListener);
    
    return () => {
      window.removeEventListener('chatUpdated', handleChatUpdated as EventListener);
      window.removeEventListener('chatUrlUpdated', handleChatUrlUpdated as EventListener);
    };
  }, [currentChatId, setCurrentChatId, navigate]);
  
  // Load chat history from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const chatId = urlParams.get('chat');
    
    if (chatId && isValidObjectId(chatId)) {
      console.log('Loading chat history for:', chatId);
      loadChatHistory(chatId);
      setCurrentChatId(chatId);
    } else {
      // Reset chat when navigating to /mfuchatbot without chat ID
      console.log('No valid chat ID found');
      useChatStore.getState().resetChat();
    }
  }, [location.search, loadChatHistory, setCurrentChatId]);
  
  // Fetch usage data when component mounts
  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);
  
  return (
    <div className="flex flex-col h-full relative">
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 pb-40 overscroll-contain scroll-smooth"
        ref={containerRef}
        id="chat-messages"
        data-testid="chat-messages-container"
      >
        {messages.length === 0 ? (
          <WelcomeMessage />
        ) : (
          <div className="space-y-6">
            {messages.map((message, index) => (
              <ChatBubble 
                key={message.id}
                message={message}
                isLastMessage={index === messages.length - 1}
                isLoading={isLoading}
                onContinueClick={handleContinueClick}
                onCancelClick={handleCancelGeneration}
                onEditClick={handleEditMessage}
                onRegenerateClick={handleRegenerateMessage}
                selectedModel={selectedModel}
              />
            ))}
            <div 
              ref={endRef} 
              id="chat-bottom-anchor"
              data-testid="chat-bottom-anchor"
              className="h-2 w-full my-2"
            />
          </div>
        )}
      </div>

      <ChatInput
        inputMessage={inputMessage}
        setInputMessage={setInputMessage}
        handleSubmit={handleSubmit}
        handleKeyDown={handleKeyDown}
        handlePaste={handlePaste}
        selectedImages={selectedImages}
        selectedFiles={selectedFiles}
        handleFileSelect={handleFileSelect}
        handleRemoveImage={handleRemoveImage}
        handleRemoveFile={handleRemoveFile}
        isImageGenerationMode={isImageGenerationMode}
        setIsImageGenerationMode={setIsImageGenerationMode}
        models={models}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        isLoading={isLoading}
        canSubmit={canSubmit}
        handleScrollToBottom={handleScrollButtonClick}
        showScrollButton={showScrollButton}
        usage={usage}
        isMobile={isMobile}
        editingMessage={editingMessage}
        handleCancelGeneration={handleCancelGeneration}
      />
    </div>
  );
};

export default MFUChatbot;
