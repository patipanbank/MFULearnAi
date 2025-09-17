import { useState, useCallback } from 'react';
import { useChatStore, useUIStore } from '../../../shared/stores';
import type { UseMessageActionsResult } from '../types';

export const useMessageActions = (): UseMessageActionsResult => {
  const currentSession = useChatStore((state) => state.currentSession);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const addToast = useUIStore((state) => state.addToast);

  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');

  const handleCopyMessage = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      addToast({
        type: 'success',
        title: 'Copied',
        message: 'Message copied to clipboard'
      });
    } catch (error) {
      console.error('Failed to copy message:', error);
      addToast({
        type: 'error',
        title: 'Copy Failed',
        message: 'Failed to copy message to clipboard'
      });
    }
    setActiveMessageMenu(null);
  }, [addToast]);

  const handleEditMessage = useCallback((messageId: string, content: string) => {
    setEditingMessage(messageId);
    setEditingContent(content);
    setActiveMessageMenu(null);
  }, []);

  const handleSaveEdit = useCallback(async (messageId: string) => {
    if (!editingContent.trim()) return;

    updateMessage(messageId, { content: editingContent.trim() });
    setEditingMessage(null);
    setEditingContent('');

    addToast({
      type: 'success',
      title: 'Message Updated',
      message: 'Message has been updated'
    });
  }, [editingContent, updateMessage, addToast]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setEditingContent('');
  }, []);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!currentSession) return;

    try {
      // Mark message as deleted
      updateMessage(messageId, { content: '[Message deleted]' });

      addToast({
        type: 'success',
        title: 'Message Deleted',
        message: 'Message has been deleted'
      });
    } catch (error) {
      console.error('Failed to delete message:', error);
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete message'
      });
    }
    setActiveMessageMenu(null);
  }, [currentSession, updateMessage, addToast]);

  return {
    activeMessageMenu,
    editingMessage,
    editingContent,
    handleCopyMessage,
    handleEditMessage,
    handleSaveEdit,
    handleCancelEdit,
    handleDeleteMessage,
    setActiveMessageMenu,
    setEditingContent
  };
};