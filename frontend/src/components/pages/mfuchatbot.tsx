import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import WelcomeMessage from '../chat/ui/WelcomeMessage';
import ChatBubble from '../chat/ui/ChatBubble';
import ChatInput from '../chat/ui/ChatInput';
import { useChatStore } from '../../store/chatStore';
import { useModelStore } from '../../store/modelStore';
import { useUIStore } from '../../store/uiStore';
import { useScrollStore } from '../../store/scrollStore';
import { isValidObjectId } from '../chat/utils/formatters';

const MFUChatbot: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // เพิ่ม refs สำหรับ scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
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
    setInputMessage,
    setIsImageGenerationMode
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
  
  // เรียกใช้ scrollStore แทน useScrollManagement
  const {
    shouldAutoScroll,
    setMessagesEndRef: setScrollMessagesEndRef,
    setChatContainerRef: setScrollChatContainerRef,
    scrollToBottom,
    handleScroll,
  } = useScrollStore();
  
  // Set refs
  useEffect(() => {
    if (messagesEndRef.current && chatContainerRef.current) {
      // ตั้งค่า refs ใน scrollStore
      setScrollMessagesEndRef(messagesEndRef);
      setScrollChatContainerRef(chatContainerRef);
      
      // ตั้งค่า refs ใน chatStore (ถ้ายังต้องการใช้)
      setMessagesEndRef(messagesEndRef);
      setChatContainerRef(chatContainerRef);
      
      // เพิ่ม event listener สำหรับการเลื่อน
      const container = chatContainerRef.current;
      container.addEventListener('scroll', handleScroll);
      
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [setScrollMessagesEndRef, setScrollChatContainerRef, setMessagesEndRef, setChatContainerRef, handleScroll]);
  
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
  
  // Update chatStore inputMessage when UIStore inputMessage changes
  useEffect(() => {
    useChatStore.getState().setInputMessage(inputMessage);
  }, [inputMessage]);
  
  // Auto scroll to bottom when new messages are added
  useEffect(() => {
    if (messages.length > 0 && shouldAutoScroll) {
      // Small delay to ensure DOM updates are processed
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [messages.length, shouldAutoScroll, scrollToBottom]);
  
  return (
    <div className="flex flex-col h-full" ref={chatContainerRef}>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-40" id="chat-messages-container">
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
