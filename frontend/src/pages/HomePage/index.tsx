import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../entities/user/store';
import { useChatStore, useAgentStore, useUIStore } from '../../shared/stores';
import ResponsiveChatInput from '../../shared/ui/ResponsiveChatInput';

const HomePage: React.FC = () => {
  const { status, token, fetchUser } = useAuthStore();
  const navigate = useNavigate();
  const { selectedAgent } = useAgentStore();
  const { addToast } = useUIStore();
  const { createNewChat } = useChatStore();

  // Local state for chat input
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<Array<{ url: string; mediaType: string }>>([]);

  useEffect(() => {
    console.log('HomePage: Current status:', status, 'Token exists:', !!token);
    
    // If we have a token but status is still loading, fetch user data
    if (token && status === 'loading') {
      console.log('HomePage: Fetching user data...');
      fetchUser();
      return; // Wait for fetchUser to complete
    }
    
    // If we have a token and user is authenticated, redirect to chat
    if (token && status === 'authenticated') {
      console.log('HomePage: Redirecting to chat...');
      navigate('/chat', { replace: true });
    } 
    // If no token or unauthenticated, redirect to login
    else if (!token || status === 'unauthenticated') {
      console.log('HomePage: Redirecting to login...');
      navigate('/login', { replace: true });
    }
  }, [status, token, navigate, fetchUser]);

  // Handle send message
  const handleSendMessage = () => {
    if (!message.trim()) return;
    if (!selectedAgent) {
      addToast({
        type: 'warning',
        title: 'Select Agent',
        message: 'Please select an AI agent before sending a message.',
        duration: 3000
      });
      return;
    }

    // Create new chat and navigate to it
    const newChat = createNewChat();
    navigate(`/chat/${newChat.id}`);
  };

  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    Array.from(files).forEach(async (file) => {
      if (!file.type.startsWith('image/')) return;
      try {
        const formData = new FormData();
        formData.append('file', file);
        // Note: Image upload functionality will be handled in the chat page
        setImages(prev => [...prev, { url: URL.createObjectURL(file), mediaType: file.type }]);
      } catch (err) {
        console.error('Image upload failed', err);
        addToast({ type: 'error', title: 'Upload Error', message: 'Failed to upload image' });
      }
    });
  };

  // Handle remove image
  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // Show loading while determining auth status
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show chat input with welcome message
  return (
    <div className="flex h-full bg-primary relative">
      {/* Add a subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="w-full h-full" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(186,12,47) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}/>
      </div>
      
      {/* Chat Area - Centered with max width */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full relative">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-2xl">
            <h1 className="text-4xl font-bold text-primary mb-4">Welcome to MFU Learn AI</h1>
            <p className="text-lg text-secondary mb-8">Start a conversation by typing your message below.</p>
          </div>
        </div>
        
        {/* Input Area - Fixed at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary via-primary to-transparent pt-6">
          <div className="px-4 pb-6">
            <ResponsiveChatInput
              message={message}
              onMessageChange={setMessage}
              onSendMessage={handleSendMessage}
              onImageUpload={handleImageUpload}
              images={images}
              onRemoveImage={handleRemoveImage}
              disabled={!selectedAgent}
              isTyping={false}
              hasMessages={false}
              isInChatRoom={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage; 