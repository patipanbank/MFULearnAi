import { useCallback } from 'react';
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

  const handleSubmit = useCallback(async () => {
    if (!wsRef || wsRef.readyState !== WebSocket.OPEN) return;

    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage && selectedImages.length === 0 && selectedFiles.length === 0) return;

    setIsLoading(true);

    try {
      // Process files
      const processedImages = await Promise.all(selectedImages.map(async (file) => {
        const compressed = await compressImage(file);
        return compressed;
      }));

      const processedFiles = await Promise.all(selectedFiles.map(async (file) => {
        const buffer = await file.arrayBuffer();
        return {
          name: file.name,
          type: file.type,
          data: Buffer.from(buffer).toString('base64'),
          mediaType: file.type,
          size: file.size
        } as MessageFile;
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
    canSubmit
  };
};

export default useChatActions; 