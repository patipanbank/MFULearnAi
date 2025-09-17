import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FiCopy } from 'react-icons/fi';
import { ToolUsageDisplay } from '../../../shared/ui/ToolUsageDisplay';
import { useUIStore } from '../../../shared/stores';
import MessageActions from './MessageActions';
import dindinAvatar from '../../../assets/dindin.png';
import type { MessageItemProps } from '../types';

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  onCopy,
  onEdit,
  onDelete,
  isEditing,
  editingContent,
  onEditingContentChange,
  onSaveEdit,
  onCancelEdit,
  showActionsMenu,
  onToggleActionsMenu,
  getInitials
}) => {
  const addToast = useUIStore((state) => state.addToast);

  // Enhanced Message Content Component with Markdown support
  const MessageContent: React.FC<{ content: string; role: 'user' | 'assistant' | 'system' }> = ({ content, role }) => {
    // Check for JSON delta patterns and extract only the delta content
    if (typeof content === 'string' && content.trim().startsWith('{') && content.includes('"delta":')) {
      try {
        const jsonMatch = content.match(/\{"messageId":"[^"]+","delta":"([^"]+)"\}/);
        if (jsonMatch && jsonMatch[1]) {
          content = jsonMatch[1];
        }
      } catch (error) {
        console.error('Failed to parse JSON delta:', error);
      }
    }

    // For assistant messages that are streaming, show loading indicator instead of "Thinking..."
    if (!content || content.trim() === '') {
      if (role === 'assistant') {
        return (
          <div className="flex space-x-1 items-center">
            <div className="w-2 h-2 bg-muted rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
        );
      }
      return <div className="text-muted italic">Empty message</div>;
    }

    // Check for error patterns that shouldn't be rendered as normal messages
    if (content.includes('[object Object]') ||
        content.includes('TypeError:') ||
        content.includes('ReferenceError:') ||
        content.includes('SyntaxError:') ||
        content.startsWith('Error:')) {

      // Show error as toast instead of message
      addToast({
        type: 'error',
        title: 'Message Error',
        message: 'There was an error processing this message'
      });
      return <div className="text-muted italic">Message processing error</div>;
    }

    // Check if content contains code blocks
    const hasCodeBlocks = content.includes('```');

    if (hasCodeBlocks && role === 'assistant') {
      try {
        return (
          <ReactMarkdown
            components={{
            code: ({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : '';

              return !inline && language ? (
                <div className="relative">
                  <div className="flex items-center justify-between bg-gray-800 px-4 py-2 rounded-t-lg">
                    <span className="text-xs text-gray-300 font-medium">{language}</span>
                    <button
                      onClick={() => onCopy(String(children))}
                      className="text-xs text-gray-400 hover:text-white transition-colors flex items-center space-x-1"
                    >
                      <FiCopy className="h-3 w-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <SyntaxHighlighter
                    style={oneDark}
                    language={language}
                    PreTag="div"
                    className="rounded-t-none !mt-0"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code
                  className="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
            li: ({ children }) => <li className="mb-1">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-accent pl-4 py-1 bg-secondary/30 rounded-r">
                {children}
              </blockquote>
            ),
          }}
          >
            {content}
          </ReactMarkdown>
        );
      } catch (error) {
        console.error('Markdown parsing error:', error);
        addToast({
          type: 'warning',
          title: 'Formatting Error',
          message: 'Could not format message properly'
        });
        // Fallback to plain text
        return (
          <div className="whitespace-pre-wrap text-base sm:text-base leading-relaxed">
            {content}
          </div>
        );
      }
    }

    // Fallback for simple text content
    return (
      <div className="whitespace-pre-wrap text-base sm:text-base leading-relaxed">
        {content}
      </div>
    );
  };

  return (
    <div
      className={`flex ${
        message.role === 'user'
          ? 'justify-end sm:mr-4 md:mr-8 lg:mr-[230px] 2xl:mr-[485px]'
          : 'justify-start ml-0 sm:ml-4 md:ml-8 lg:ml-[245px] 2xl:ml-[500px]'
      } items-end space-x-2 px-1 sm:px-2 group animate-fade-in`}
    >
      {message.role !== 'user' && (
        <div className="flex-shrink-0 ml-1 sm:ml-0">
          <img
            src={dindinAvatar}
            alt="DINDIN AI"
            className="w-8 h-8 sm:w-8 sm:h-8 rounded-full shadow-md"
          />
        </div>
      )}
      <div className="flex flex-col max-w-[75%] sm:max-w-[65%] md:max-w-[60%] lg:max-w-[55%] 2xl:max-w-[50%] relative">
        {/* Timestamp */}
        <div className={`text-[10px] sm:text-xs mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
          message.role === 'user' ? 'text-right text-muted' : 'text-left text-muted'
        }`}>
          {message.role === 'user'
            ? (() => { const d = new Date(message.timestamp); d.setHours(d.getHours() + 7); return d.toLocaleTimeString(); })()
            : message.timestamp.toLocaleTimeString()}
        </div>

        {/* Message Actions Menu */}
        <MessageActions
          messageId={message.id}
          messageRole={message.role}
          messageContent={message.content}
          isVisible={showActionsMenu}
          onCopy={onCopy}
          onEdit={onEdit}
          onDelete={onDelete}
          onClose={onToggleActionsMenu}
        />

        <div
          className={`px-3 sm:px-4 py-2 sm:py-3 rounded-2xl shadow-sm transition-all duration-200 hover:shadow-md ${
            message.role === 'user'
              ? 'bg-blue-600 text-white rounded-br-sm hover:bg-blue-700'
              : 'card text-primary rounded-bl-sm hover:border-border-hover'
          }`}
        >
          {/* Images */}
          {message.images && message.images.length > 0 && (
            <div className="mb-3">
              <div className={`grid gap-2 sm:gap-3 ${
                message.images.length === 1 ? 'grid-cols-1' :
                message.images.length === 2 ? 'grid-cols-2' :
                'grid-cols-2 md:grid-cols-3'
              }`}>
                {message.images.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={img.url}
                      alt={`Image ${idx + 1}`}
                      className="rounded-lg w-full h-auto max-h-64 object-cover shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer border border-primary"
                      onClick={() => window.open(img.url, '_blank')}
                      onError={(e) => {
                        console.error('Chat image failed to load:', img.url);
                        addToast({
                          type: 'error',
                          title: 'Image Error',
                          message: `Failed to load image: ${img.url.split('/').pop()}`
                        });
                        e.currentTarget.style.display = 'none';
                      }}
                      onLoad={() => {
                        console.log('Chat image loaded successfully:', img.url);
                      }}
                      loading="lazy"
                      style={{
                        display: 'block',
                        minHeight: '80px',
                        backgroundColor: 'rgb(var(--color-card))'
                      }}
                    />
                    {/* Image overlay info */}
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {img.mediaType?.split('/')[1]?.toUpperCase() || 'IMG'}
                    </div>
                    {/* Loading placeholder while image loads */}
                    <div className="absolute inset-0 bg-secondary rounded-lg animate-pulse opacity-30"
                         style={{ zIndex: -1 }} />
                  </div>
                ))}
              </div>
              {/* Image count indicator */}
              {message.images.length > 1 && (
                <div className="mt-2 text-xs text-muted">
                  {message.images.length} images attached
                </div>
              )}
            </div>
          )}

          {/* Message Content */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editingContent}
                onChange={(e) => onEditingContentChange(e.target.value)}
                className={`w-full min-h-[60px] p-2 rounded-lg border resize-none ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white border-blue-400 placeholder-blue-200'
                    : 'bg-card text-primary border-border'
                }`}
                placeholder="Edit message..."
                autoFocus
              />
              <div className="flex space-x-2 justify-end">
                <button
                  onClick={onCancelEdit}
                  className="px-3 py-1 text-xs rounded-md hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onSaveEdit(message.id)}
                  className="px-3 py-1 text-xs bg-accent text-white rounded-md hover:bg-accent/80 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Wrap MessageContent in error boundary */}
              <React.Suspense fallback={<div className="text-muted">Loading...</div>}>
                <MessageContent content={message.content} role={message.role} />
              </React.Suspense>
              {message.isStreaming && (
                <span className="inline-block w-2 sm:w-2 h-5 sm:h-5 bg-current animate-pulse ml-1" />
              )}
            </div>
          )}

          {/* Tool Usage Display */}
          {message.toolUsage && message.toolUsage.length > 0 && (
            <ToolUsageDisplay toolUsage={message.toolUsage} />
          )}
        </div>
      </div>
      {message.role === 'user' && (
        <div className="flex-shrink-0">
          <div className="h-8 w-8 sm:h-8 sm:w-8 bg-gradient-to-br from-[rgb(186,12,47)] to-[rgb(212,175,55)] rounded-full flex items-center justify-center text-white text-sm sm:text-sm font-medium shadow-md">
            {getInitials()}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(MessageItem);