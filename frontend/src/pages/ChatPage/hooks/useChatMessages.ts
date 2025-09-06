import { useCallback } from 'react';
import { useChatStore, useAuthStore, useUIStore } from '../../../shared/stores';
import { api } from '../../../shared/lib/api';

export const useChatMessages = () => {
  const currentSession = useChatStore((state) => state.currentSession);
  const addMessage = useChatStore((state) => state.addMessage);
  const isTyping = useChatStore((state) => state.isTyping);
  const user = useAuthStore((state) => state.user);
  const addToast = useUIStore((state) => state.addToast);

  const getInitials = useCallback(() => {
    if (!user) return 'U';
    const firstInitial = user.firstName?.charAt(0) || '';
    const lastInitial = user.lastName?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'U';
  }, [user]);

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return [];

    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const uploadedImages: Array<{ url: string; mediaType: string }> = [];

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

        const response = await api.post<{ url: string }>('/upload/image', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        uploadedImages.push({ url: response.url, mediaType: file.type });
      } catch (error) {
        console.error('Failed to upload image:', error);
        addToast({
          type: 'error',
          title: 'Upload Failed',
          message: `Failed to upload ${file.name}`
        });
      }
    }
    
    return uploadedImages;
  }, [addToast]);

  return {
    currentSession,
    messages: currentSession?.messages || [],
    isTyping,
    getInitials,
    handleImageUpload,
    addMessage
  };
};