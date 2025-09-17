import React from 'react';
import { FiCopy, FiEdit3, FiTrash2, FiMoreHorizontal } from 'react-icons/fi';
import type { MessageActionsProps } from '../types';

const MessageActions: React.FC<MessageActionsProps> = ({
  messageId,
  messageRole,
  messageContent,
  isVisible,
  onCopy,
  onEdit,
  onDelete,
  onClose
}) => {
  if (!isVisible) return null;

  return (
    <div className={`absolute top-0 ${
      messageRole === 'user' ? '-left-10' : '-right-10'
    } opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
      <div className="relative">
        <button
          onClick={onClose}
          className="p-1 hover:bg-secondary rounded-lg transition-colors"
          aria-label="Message actions"
        >
          <FiMoreHorizontal className="h-4 w-4 text-muted" />
        </button>

        {/* Actions Dropdown */}
        <div className={`absolute top-8 ${
          messageRole === 'user' ? 'right-0' : 'left-0'
        } bg-card border border-border rounded-lg shadow-lg py-1 z-50 min-w-[120px]`}>
          <button
            onClick={() => onCopy(messageContent)}
            className="flex items-center space-x-2 w-full px-3 py-2 text-sm hover:bg-secondary transition-colors text-left"
          >
            <FiCopy className="h-3 w-3" />
            <span>Copy</span>
          </button>
          {messageRole === 'user' && (
            <>
              <button
                onClick={() => onEdit(messageId, messageContent)}
                className="flex items-center space-x-2 w-full px-3 py-2 text-sm hover:bg-secondary transition-colors text-left"
              >
                <FiEdit3 className="h-3 w-3" />
                <span>Edit</span>
              </button>
              <button
                onClick={() => onDelete(messageId)}
                className="flex items-center space-x-2 w-full px-3 py-2 text-sm hover:bg-red-50 hover:text-red-600 transition-colors text-left"
              >
                <FiTrash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageActions;