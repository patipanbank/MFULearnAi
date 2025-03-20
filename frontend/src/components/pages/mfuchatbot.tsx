import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import WelcomeMessage from '../chat/ui/WelcomeMessage';
import ChatBubble from '../chat/ui/ChatBubble';
import ChatInput from '../chat/ui/ChatInput';
import useScrollManagement from '../chat/hooks/useScrollManagement';
import useChatWebSocket from '../chat/hooks/useChatWebSocket';
import useChatActions from '../chat/hooks/useChatActions';
import useChatState from '../chat/hooks/useChatState';
import useChatStore from '../../store/chatStore';
import { config } from '../../config/config';

const MFUChatbot: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get chat state from the hook
  const {
    messages,
    inputMessage, 
    setInputMessage,
    isLoading,
    isImageGenerationMode,
    setIsImageGenerationMode,
    selectedModel,
    setSelectedModel,
    selectedImages,
    setSelectedImages,
    selectedFiles,
    setSelectedFiles,
    usage,
    isLoadingChat,
  } = useChatStore();

  // Initialize WebSocket connection
  useChatWebSocket();

  // Get scroll management
  const {
    messagesEndRef,
    chatContainerRef,
  } = useScrollManagement();

  // Get chat actions
  const {
    handleSubmit,
    handleKeyDown,
    handlePaste,
    handleContinueClick,
    canSubmit,
    errorMessage
  } = useChatActions();

  // Fetch available models on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        const response = await fetch(`${config.apiUrl}/api/models`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          const models = data.map((model: any) => ({
            id: model._id,
            name: model.name,
            modelType: model.modelType
          }));
          
          useChatStore.getState().setModels(models);
          
          if (models.length > 0 && !selectedModel) {
            setSelectedModel(models[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    };

    fetchModels();
  }, [setSelectedModel, selectedModel]);

  // Handle reload button
  const handleReload = () => {
    window.location.reload();
  };

  // Show loading state
  const renderChatContent = () => {
    if (isLoadingChat) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-pulse flex space-x-2 mb-4 justify-center">
              <div className="h-3 w-3 bg-blue-400 rounded-full"></div>
              <div className="h-3 w-3 bg-blue-400 rounded-full"></div>
              <div className="h-3 w-3 bg-blue-400 rounded-full"></div>
            </div>
            <p className="text-gray-600 dark:text-gray-300">Loading chat history...</p>
          </div>
        </div>
      );
    }
    
    // When a chat ID is in the URL but no messages are loaded
    const params = new URLSearchParams(location.search);
    const chatId = params.get('chat');
    
    if (chatId && messages.length === 0 && !isLoadingChat) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-600 dark:text-red-400 mb-2">Error Loading Chat</p>
            <p className="text-gray-600 dark:text-gray-300 mb-4">There was a problem loading this chat history.</p>
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={handleReload}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
              >
                Reload Page
              </button>
              <button 
                onClick={() => navigate('/mfuchatbot')}
                className="text-blue-500 hover:text-blue-700 underline"
              >
                Start New Chat
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    if (messages.length === 0) {
      return <WelcomeMessage />;
    }
    
    return messages.map((message, index) => (
      <ChatBubble
        key={index}
        message={message}
        isLastMessage={index === messages.length - 1}
        isLoading={isLoading && index === messages.length - 1}
        onContinueClick={handleContinueClick}
        selectedModel={selectedModel}
      />
    ));
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {renderChatContent()}
        
        <div ref={messagesEndRef} />
      </div>

      {errorMessage && (
        <div className="p-2 bg-red-100 dark:bg-red-900 border-t border-red-200 dark:border-red-800">
          <p className="text-red-600 dark:text-red-300 text-sm text-center">{errorMessage}</p>
        </div>
      )}

      <ChatInput
        inputMessage={inputMessage}
        handleSubmit={handleSubmit}
        handleKeyDown={handleKeyDown}
        handlePaste={handlePaste}
        isLoading={isLoading}
        selectedImages={selectedImages}
        selectedFiles={selectedFiles}
        models={useChatStore.getState().models}
        selectedModel={selectedModel}
        isImageGenerationMode={isImageGenerationMode}
        canSubmit={canSubmit}
        usage={usage}
        onInputChange={setInputMessage}
        onImagesChange={setSelectedImages}
        onFilesChange={setSelectedFiles}
        onModelChange={setSelectedModel}
        onImageGenerationModeChange={setIsImageGenerationMode} 
        handleScrollToBottom={function (): void {
          throw new Error('Function not implemented.');
        }} 
        isNearBottom={false} 
        isMobile={false}
      />
    </div>
  );
};

export default MFUChatbot;
