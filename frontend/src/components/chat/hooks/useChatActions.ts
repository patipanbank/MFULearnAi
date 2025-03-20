import { useCallback, useState } from 'react';
import { Message, MessageFile } from '../utils/types';
import { compressImage, validateImageFile } from '../utils/fileProcessing';
import useChatStore from '../../../store/chatStore';

const useChatActions = () => {
  const {
    messages,
    setMessages,
    inputMessage,
    setInputMessage,
    selectedImages,
    setSelectedImages,
    selectedFiles,
    setSelectedFiles,
    selectedModel,
    isImageGenerationMode,
    wsRef,
    setIsLoading,
    isLoading
  } = useChatStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    // Clear any previous error
    setErrorMessage(null);
    
    if (!wsRef) {
      setErrorMessage('Connection to server is not established. Please refresh the page.');
      return;
    }
    
    if (wsRef.readyState !== WebSocket.OPEN) {
      setErrorMessage('Connection to server is closed. Please refresh the page.');
      return;
    }

    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage && selectedImages.length === 0 && selectedFiles.length === 0) return;

    setIsLoading(true);

    try {
      // Process files
      const processedImages = await Promise.all(selectedImages.map(async (file) => {
        try {
          const compressed = await compressImage(file);
          return compressed;
        } catch (error) {
          console.error(`Error compressing image ${file.name}:`, error);
          throw new Error(`Could not process image: ${file.name}`);
        }
      }));

      const processedFiles = await Promise.all(selectedFiles.map(async (file) => {
        try {
          const buffer = await file.arrayBuffer();
          return {
            name: file.name,
            type: file.type,
            data: Buffer.from(buffer).toString('base64'),
            mediaType: file.type,
            size: file.size
          } as MessageFile;
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          throw new Error(`Could not process file: ${file.name}`);
        }
      }));

      // Create message object
      const newMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: trimmedMessage,
        timestamp: { $date: new Date().toISOString() },
        images: processedImages,
        files: processedFiles
      };

      // Add message to state
      setMessages([...messages, newMessage]);

      // Add empty assistant message for streaming response
      const assistantMessage: Message = {
        id: `${Date.now() + 1}`,
        role: 'assistant',
        content: '',
        timestamp: { $date: new Date().toISOString() },
        isComplete: false
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      // Clear input and files
      setInputMessage('');
      setSelectedImages([]);
      setSelectedFiles([]);

      // Send message through WebSocket
      wsRef.send(JSON.stringify({
        type: 'message',
        content: trimmedMessage,
        images: processedImages,
        files: processedFiles,
        model: selectedModel,
        isImageGeneration: isImageGenerationMode,
      }));

    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
      
      // Show user-friendly error
      if (error instanceof Error) {
        setErrorMessage(`Error: ${error.message}`);
      } else {
        setErrorMessage('An unknown error occurred while sending your message.');
      }
      
      // Remove the last assistant message if it was added
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    }
  }, [
    wsRef,
    inputMessage,
    selectedImages,
    selectedFiles,
    selectedModel,
    isImageGenerationMode,
    messages,
    setMessages,
    setInputMessage,
    setSelectedImages,
    setSelectedFiles,
    setIsLoading
  ]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageItem = Array.from(items).find(item => item.type.startsWith('image'));
    
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file && await validateImageFile(file)) {
        const files = [...selectedImages, file];
        setSelectedImages(files);
      }
    }
  }, [selectedImages, setSelectedImages]);

  const handleContinueClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!wsRef || wsRef.readyState !== WebSocket.OPEN) return;

    wsRef.send(JSON.stringify({
      type: 'continue',
      model: selectedModel,
    }));
  }, [wsRef, selectedModel]);

  const canSubmit = Boolean(
    wsRef &&
    wsRef.readyState === WebSocket.OPEN &&
    (inputMessage.trim() || selectedImages.length > 0 || selectedFiles.length > 0) &&
    !isLoading
  );

  return {
    handleSubmit,
    handleKeyDown,
    handlePaste,
    handleContinueClick,
    canSubmit,
    errorMessage
  };
};

export default useChatActions; 