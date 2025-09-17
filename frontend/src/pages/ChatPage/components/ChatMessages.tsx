import React from 'react';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import type { ChatMessagesProps } from '../types';

const ChatMessages: React.FC<ChatMessagesProps & { isTyping?: boolean }> = ({
  messages,
  onCopyMessage,
  onEditMessage,
  onDeleteMessage,
  onSaveEdit,
  onCancelEdit,
  editingMessage,
  editingContent,
  onEditingContentChange,
  activeMessageMenu,
  onSetActiveMessageMenu,
  getInitials,
  messagesEndRef,
  isTyping = false
}) => {
  return (
    <div className="flex-1 overflow-y-auto px-0 sm:px-4 py-4 pb-32 space-y-4 h-full [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 dark:hover:[&::-webkit-scrollbar-thumb]:bg-gray-500">
      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          message={msg}
          onCopy={onCopyMessage}
          onEdit={onEditMessage}
          onDelete={onDeleteMessage}
          isEditing={editingMessage === msg.id}
          editingContent={editingContent}
          onEditingContentChange={onEditingContentChange}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
          showActionsMenu={activeMessageMenu === msg.id}
          onToggleActionsMenu={() => onSetActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id)}
          getInitials={getInitials}
        />
      ))}

      <TypingIndicator isVisible={isTyping} />

      <div ref={messagesEndRef} />
    </div>
  );
};

export default React.memo(ChatMessages);