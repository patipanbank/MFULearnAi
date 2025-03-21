import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IoIosArrowDown } from "react-icons/io";
import WelcomeMessage from '../chat/ui/WelcomeMessage';
import ChatBubble from '../chat/ui/ChatBubble';
import ChatInput from '../chat/ui/ChatInput';
import { useChatStore } from '../chat/store/chatStore';
import { useModelStore } from '../chat/store/modelStore';
import { useUIStore } from '../chat/store/uiStore';
import { isValidObjectId } from '../chat/utils/formatters';

const MFUChatbot: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Chat state from Zustand
  const {
    messages,
    currentChatId,
    selectedImages,
    selectedFiles,
    editingMessage,
    setMessagesEndRef,
    setChatContainerRef,
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
    isNearBottom,
    messagesEndRef,
    chatContainerRef,
    setInputMessage,
    setIsImageGenerationMode,
    setMessageCount,
    initScrollListener,
    handleScrollToBottom,
  } = useUIStore();
  
  // Model state from Zustand
  const {
    models,
    selectedModel,
    usage,
    setSelectedModel,
    fetchUsage,
    fetchModels
  } = useModelStore();
  
  // สร้าง cleanup function สำหรับ scroll listener
  useEffect(() => {
    const cleanup = initScrollListener();
    return cleanup;
  }, [initScrollListener]);
  
  // อัปเดตจำนวนข้อความเมื่อมีการเปลี่ยนแปลง
  useEffect(() => {
    setMessageCount(messages.length);
  }, [messages, setMessageCount]);
  
  // ทำการ auto-scroll เมื่อมีข้อความใหม่หรือสถานะโหลดเปลี่ยนแปลง
  useEffect(() => {
    const { shouldAutoScroll, userScrolledManually, scrollToBottom } = useUIStore.getState();
    // เฉพาะกรณีที่เปิดใช้ auto-scroll และผู้ใช้ไม่ได้เลื่อนเอง
    if (shouldAutoScroll && !userScrolledManually) {
      // ใช้ requestAnimationFrame เพื่อให้แน่ใจว่า DOM ได้อัพเดทแล้ว
      requestAnimationFrame(() => {
        scrollToBottom(true);
      });
    }
  }, [messages]);
  
  // แยก useEffect สำหรับการโหลด เพื่อให้ scroll ทำงานได้ดีขึ้น
  useEffect(() => {
    if (isLoading) {
      const { scrollToBottom } = useUIStore.getState();
      requestAnimationFrame(() => {
        scrollToBottom(true);
      });
    }
  }, [isLoading]);
  
  // Set refs in the chat store
  useEffect(() => {
    setMessagesEndRef(messagesEndRef);
    setChatContainerRef(chatContainerRef);
  }, [messagesEndRef, chatContainerRef, setMessagesEndRef, setChatContainerRef]);
  
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
    <div className="flex flex-col h-full" ref={chatContainerRef}>
      {/* Scroll to bottom button - improved visibility based on scroll distance */}
      {!isNearBottom && (
        <button
          onClick={handleScrollToBottom}
          className="fixed bottom-[180px] md:bottom-[120px] right-4 md:right-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 md:p-3 shadow-lg transition-all duration-300 z-20"
          aria-label="Scroll to latest messages"
        >
          <IoIosArrowDown className="h-4 w-4 md:h-5 md:w-5" />
        </button>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-40">
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
            <div ref={messagesEndRef} />
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
        usage={usage}
        isMobile={isMobile}
        editingMessage={editingMessage}
        handleCancelGeneration={handleCancelGeneration}
      />
    </div>
  );
};

export default MFUChatbot;
