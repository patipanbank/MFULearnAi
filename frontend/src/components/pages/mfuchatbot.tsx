import React, { useEffect } from 'react';
import WelcomeMessage from '../chat/ui/WelcomeMessage';
import ChatBubble from '../chat/ui/ChatBubble';
import ChatInput from '../chat/ui/ChatInput';
import useScrollManagement from '../chat/hooks/useScrollManagement';
import useChatWebSocket from '../chat/hooks/useChatWebSocket';
import useChatActions from '../chat/hooks/useChatActions';
import useChatStore from '../../store/chatStore';
import { config } from '../../config/config';

const MFUChatbot: React.FC = () => {
  const {
    messages,
    inputMessage,
    setInputMessage,
    isLoading,
    isImageGenerationMode,
    setIsImageGenerationMode,
    models,
    setModels,
    selectedModel,
    setSelectedModel,
    selectedImages,
    setSelectedImages,
    selectedFiles,
    setSelectedFiles,
    usage,
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
    canSubmit
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
          setModels(data);
          if (data.length > 0 && !selectedModel) {
            setSelectedModel(data[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    };

    fetchModels();
  }, [setModels, setSelectedModel, selectedModel]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 && <WelcomeMessage />}
        
        {messages.map((message, index) => (
          <ChatBubble
            key={index}
            message={message}
            isLastMessage={index === messages.length - 1}
            isLoading={isLoading && index === messages.length - 1}
            onContinueClick={handleContinueClick}
            selectedModel={selectedModel}
          />
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        inputMessage={inputMessage}
        handleSubmit={handleSubmit}
        handleKeyDown={handleKeyDown}
        handlePaste={handlePaste}
        isLoading={isLoading}
        selectedImages={selectedImages}
        selectedFiles={selectedFiles}
        models={models}
        selectedModel={selectedModel}
        isImageGenerationMode={isImageGenerationMode}
        canSubmit={canSubmit}
        usage={usage}
        onInputChange={setInputMessage}
        onImagesChange={setSelectedImages}
        onFilesChange={setSelectedFiles}
        onModelChange={setSelectedModel}
        onImageGenerationModeChange={setIsImageGenerationMode} handleScrollToBottom={function (): void {
          throw new Error('Function not implemented.');
        } } isNearBottom={false} isMobile={false}      />
    </div>
  );
};

export default MFUChatbot;
