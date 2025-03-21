import React, { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import WelcomeMessage from '../chat/ui/WelcomeMessage';
import ChatBubble from '../chat/ui/ChatBubble';
import ChatInput from '../chat/ui/ChatInput';
import useScrollManagement from '../chat/hooks/useScrollManagement';
import { useChatStore, ChatState } from '../../store/chatStore';
import { useModelStore, type ModelState } from '../../store/modelStore';
import { useUIStore, UIState } from '../../store/uiStore';

// Create selectors for optimized rendering
const selectMessages = (state: ChatState) => state.messages;
const selectCurrentChatId = (state: ChatState) => state.currentChatId;
const selectSelectedImages = (state: ChatState) => state.selectedImages;
const selectSelectedFiles = (state: ChatState) => state.selectedFiles;
const selectCanSubmit = (state: ChatState) => state.canSubmit();
const selectHandleSubmit = (state: ChatState) => state.handleSubmit;
const selectHandleContinueClick = (state: ChatState) => state.handleContinueClick;
const selectCancelGeneration = (state: ChatState) => state.cancelGeneration;

const selectIsLoading = (state: UIState) => state.isLoading;
const selectIsImageGenerationMode = (state: UIState) => state.isImageGenerationMode;
const selectIsMobile = (state: UIState) => state.isMobile;
const selectInputMessage = (state: UIState) => state.inputMessage;

const selectModels = (state: ModelState) => state.models;
const selectSelectedModel = (state: ModelState) => state.selectedModel;
const selectUsage = (state: ModelState) => state.usage;

const MFUChatbot: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Use selectors for more granular state access
  const messages = useChatStore(selectMessages);
  const currentChatId = useChatStore(selectCurrentChatId);
  const selectedImages = useChatStore(selectSelectedImages);
  const selectedFiles = useChatStore(selectSelectedFiles);
  const canSubmitChat = useChatStore(selectCanSubmit);
  const handleSubmit = useChatStore(selectHandleSubmit);
  const handleContinueClick = useChatStore(selectHandleContinueClick);
  const handleCancelClick = useChatStore(selectCancelGeneration);
  
  // Access actions from the chat store
  const {
    setMessagesEndRef,
    setChatContainerRef,
    initWebSocket,
    loadChatHistory,
    handleKeyDown,
    handlePaste,
    handleFileSelect,
    handleRemoveImage,
    handleRemoveFile,
    setInputMessage: setChatInputMessage
  } = useChatStore((state) => ({
    setMessagesEndRef: state.setMessagesEndRef,
    setChatContainerRef: state.setChatContainerRef,
    initWebSocket: state.initWebSocket,
    loadChatHistory: state.loadChatHistory,
    handleKeyDown: state.handleKeyDown,
    handlePaste: state.handlePaste,
    handleFileSelect: state.handleFileSelect,
    handleRemoveImage: state.handleRemoveImage,
    handleRemoveFile: state.handleRemoveFile,
    setInputMessage: state.setInputMessage
  }));
  
  // UI state
  const isLoading = useUIStore(selectIsLoading);
  const isImageGenerationMode = useUIStore(selectIsImageGenerationMode);
  const isMobile = useUIStore(selectIsMobile);
  const inputMessage = useUIStore(selectInputMessage);
  
  // UI actions
  const { 
    setInputMessage: setUIInputMessage, 
    setIsImageGenerationMode,
    initMobileDetection
  } = useUIStore((state) => ({
    setInputMessage: state.setInputMessage,
    setIsImageGenerationMode: state.setIsImageGenerationMode,
    initMobileDetection: state.initMobileDetection
  }));
  
  // Model state
  const models = useModelStore(selectModels);
  const selectedModel = useModelStore(selectSelectedModel);
  const usage = useModelStore(selectUsage);
  
  // Model actions
  const { setSelectedModel, fetchUsage, fetchModels } = useModelStore((state) => ({
    setSelectedModel: state.setSelectedModel,
    fetchUsage: state.fetchUsage,
    fetchModels: state.fetchModels,
  }));
  
  // Scrolling management
  const {
    messagesEndRef,
    chatContainerRef,
    isNearBottom,
    handleScrollToBottom,
  } = useScrollManagement({ messages });
  
  // Set refs in the chat store
  useEffect(() => {
    setMessagesEndRef(messagesEndRef);
    setChatContainerRef(chatContainerRef);
  }, [messagesEndRef, chatContainerRef, setMessagesEndRef, setChatContainerRef]);
  
  // Initialize WebSocket when component mounts
  useEffect(() => {
    initWebSocket();
  }, [initWebSocket]);
  
  // Initialize mobile detection
  useEffect(() => {
    const cleanup = initMobileDetection();
    return cleanup;
  }, [initMobileDetection]);
  
  // Fetch models on first load
  useEffect(() => {
    fetchModels();
    fetchUsage();
  }, [fetchModels, fetchUsage]);
  
  // Load chat from URL if needed
  useEffect(() => {
    if (location.pathname === '/') {
      loadChatHistory(null);
    } else {
      const pathParts = location.pathname.split('/');
      const chatId = pathParts[pathParts.length - 1];
      
      // Only load if chat ID has changed
      if (chatId && chatId !== currentChatId) {
        loadChatHistory(chatId);
      }
    }
  }, [location.pathname, currentChatId, loadChatHistory]);
  
  // Update URL when chat ID changes
  useEffect(() => {
    if (currentChatId && location.pathname !== `/chat/${currentChatId}`) {
      navigate(`/chat/${currentChatId}`, { replace: true });
    }
  }, [currentChatId, location.pathname, navigate]);
  
  // Sync input message between UI store and Chat store
  useEffect(() => {
    setChatInputMessage(inputMessage);
  }, [inputMessage, setChatInputMessage]);
  
  // Handle input change with memoization for better performance
  const handleInputChange = useCallback((value: string) => {
    setUIInputMessage(value);
  }, [setUIInputMessage]);
  
  return (
    <div className="flex flex-col h-screen">
      {/* Main chat area */}
      <div 
        ref={chatContainerRef} 
        className="flex-1 overflow-y-auto px-4 md:px-8 pt-4 pb-4 space-y-6"
      >
        {messages.length === 0 ? (
          <WelcomeMessage />
        ) : (
          messages.map((message) => (
            <ChatBubble 
              key={`${message.id}-${message.role}`}
              message={message}
              isLastMessage={message.id === messages[messages.length - 1].id}
              isLoading={isLoading}
              onContinueClick={handleContinueClick}
              onCancelClick={handleCancelClick}
              selectedModel={selectedModel}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area */}
      <ChatInput
        inputMessage={inputMessage}
        setInputMessage={handleInputChange}
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
        canSubmit={() => canSubmitChat}
        handleScrollToBottom={handleScrollToBottom}
        isNearBottom={isNearBottom}
        usage={usage}
        isMobile={isMobile}
      />
    </div>
  );
};

export default MFUChatbot;
