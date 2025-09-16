import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FixedSizeList as List, VariableSizeList, ListChildComponentProps } from 'react-window';
import { ChatMessage } from '../stores/chatStore';

interface VirtualChatListProps {
  messages: ChatMessage[];
  height: number;
  width?: number | string;
  itemHeight?: number;
  overscan?: number;
  autoScroll?: boolean;
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
  renderMessage: (message: ChatMessage, index: number, style: React.CSSProperties) => React.ReactNode;
  className?: string;
}

interface MessageItemProps extends ListChildComponentProps {
  data: {
    messages: ChatMessage[];
    renderMessage: VirtualChatListProps['renderMessage'];
  };
}

// Variable height list item for messages with different content lengths
const MessageItem: React.FC<MessageItemProps> = ({ index, style, data }) => {
  const { messages, renderMessage } = data;
  const message = messages[index];

  if (!message) return null;

  return (
    <div style={style}>
      {renderMessage(message, index, style)}
    </div>
  );
};

// Hook for calculating dynamic heights
const useMessageHeights = (messages: ChatMessage[]) => {
  const [heights, setHeights] = useState<Map<number, number>>(new Map());
  const measureRef = useRef<HTMLDivElement>(null);

  const getItemHeight = useCallback((index: number) => {
    return heights.get(index) || 100; // Default height
  }, [heights]);

  const setItemHeight = useCallback((index: number, height: number) => {
    setHeights(prev => {
      const newHeights = new Map(prev);
      newHeights.set(index, height);
      return newHeights;
    });
  }, []);

  // Reset heights when messages change
  useEffect(() => {
    setHeights(new Map());
  }, [messages.length]);

  return { getItemHeight, setItemHeight, measureRef };
};

// Message item with height measurement
const MeasuredMessageItem: React.FC<MessageItemProps> = ({ index, style, data }) => {
  const { messages, renderMessage } = data;
  const message = messages[index];
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (itemRef.current && data.setItemHeight) {
      const height = itemRef.current.offsetHeight;
      data.setItemHeight(index, height);
    }
  }, [index, message.content, data]);

  if (!message) return null;

  return (
    <div ref={itemRef} style={style}>
      {renderMessage(message, index, style)}
    </div>
  );
};

// Main virtual chat list component
export const VirtualChatList: React.FC<VirtualChatListProps> = ({
  messages,
  height,
  width = '100%',
  itemHeight = 100,
  overscan = 5,
  autoScroll = true,
  onScroll,
  renderMessage,
  className,
}) => {
  const listRef = useRef<VariableSizeList>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(autoScroll);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  const { getItemHeight, setItemHeight } = useMessageHeights(messages);

  // Memoized data for items
  const itemData = useMemo(() => ({
    messages,
    renderMessage,
    setItemHeight,
  }), [messages, renderMessage, setItemHeight]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (shouldAutoScroll && !isUserScrolling && listRef.current && messages.length > 0) {
      // Small delay to ensure rendering is complete
      setTimeout(() => {
        listRef.current?.scrollToItem(messages.length - 1, 'end');
      }, 50);
    }
  }, [messages.length, shouldAutoScroll, isUserScrolling]);

  // Handle scroll events
  const handleScroll = useCallback(({
    scrollDirection,
    scrollOffset,
    scrollUpdateWasRequested,
  }: {
    scrollDirection: 'forward' | 'backward';
    scrollOffset: number;
    scrollUpdateWasRequested: boolean;
  }) => {
    // Track user scrolling vs programmatic scrolling
    if (!scrollUpdateWasRequested) {
      setIsUserScrolling(true);

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Reset user scrolling state after delay
      scrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false);
      }, 1000);

      // Check if user scrolled to bottom
      const list = listRef.current;
      if (list) {
        const scrollHeight = list.props.height as number;
        const clientHeight = height;
        const atBottom = scrollOffset + clientHeight >= scrollHeight - 50; // 50px threshold

        setShouldAutoScroll(atBottom);
      }
    }

    // Call external scroll handler
    if (onScroll && listRef.current) {
      const scrollHeight = messages.length * itemHeight; // Approximate
      onScroll(scrollOffset, scrollHeight, height);
    }
  }, [onScroll, height, messages.length, itemHeight]);

  // Scroll to specific message
  const scrollToMessage = useCallback((messageIndex: number, align: 'start' | 'center' | 'end' = 'center') => {
    listRef.current?.scrollToItem(messageIndex, align);
  }, []);

  // Scroll to bottom programmatically
  const scrollToBottom = useCallback(() => {
    setShouldAutoScroll(true);
    listRef.current?.scrollToItem(messages.length - 1, 'end');
  }, [messages.length]);

  // Get visible range for optimization
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });

  const handleItemsRendered = useCallback(({
    visibleStartIndex,
    visibleStopIndex,
  }: {
    visibleStartIndex: number;
    visibleStopIndex: number;
  }) => {
    setVisibleRange({ start: visibleStartIndex, end: visibleStopIndex });
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // If using variable heights
  const useVariableHeight = useMemo(() => {
    return messages.some(msg => msg.content.length > 200 || msg.images?.length); // Use variable height for long messages or images
  }, [messages]);

  if (useVariableHeight) {
    return (
      <div className={className}>
        <VariableSizeList
          ref={listRef}
          height={height}
          width={width}
          itemCount={messages.length}
          itemSize={getItemHeight}
          itemData={itemData}
          overscanCount={overscan}
          onScroll={handleScroll}
          onItemsRendered={handleItemsRendered}
        >
          {MeasuredMessageItem}
        </VariableSizeList>

        {/* Scroll to bottom button */}
        {!shouldAutoScroll && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600 transition-colors"
            aria-label="Scroll to bottom"
          >
            ↓
          </button>
        )}
      </div>
    );
  }

  // Fixed height list for better performance with uniform messages
  return (
    <div className={className} style={{ position: 'relative' }}>
      <List
        ref={listRef as any}
        height={height}
        width={width}
        itemCount={messages.length}
        itemSize={itemHeight}
        itemData={itemData}
        overscanCount={overscan}
        onScroll={handleScroll}
        onItemsRendered={handleItemsRendered}
      >
        {MessageItem}
      </List>

      {/* Scroll indicators */}
      {!shouldAutoScroll && (
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <button
            onClick={scrollToBottom}
            className="bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600 transition-colors"
            aria-label="Scroll to bottom"
          >
            ↓
          </button>
          <div className="bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
            {visibleRange.start + 1}-{visibleRange.end + 1} of {messages.length}
          </div>
        </div>
      )}
    </div>
  );
};

// Infinite loading wrapper for large chat histories
interface InfiniteVirtualChatListProps extends VirtualChatListProps {
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => void;
  loadPrevious?: () => void;
}

export const InfiniteVirtualChatList: React.FC<InfiniteVirtualChatListProps> = ({
  hasMore,
  isLoading,
  loadMore,
  loadPrevious,
  ...props
}) => {
  const [shouldLoadMore, setShouldLoadMore] = useState(false);

  const handleScroll = useCallback((scrollTop: number, scrollHeight: number, clientHeight: number) => {
    // Load more when scrolled to top (for chat history)
    if (scrollTop < 100 && hasMore && !isLoading && !shouldLoadMore) {
      setShouldLoadMore(true);
      loadMore();
    }

    // Reset load more flag when not near top
    if (scrollTop > 200) {
      setShouldLoadMore(false);
    }

    // Call original scroll handler
    props.onScroll?.(scrollTop, scrollHeight, clientHeight);
  }, [hasMore, isLoading, shouldLoadMore, loadMore, props.onScroll]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Loading indicator at top */}
      {isLoading && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded text-sm z-10">
          Loading more messages...
        </div>
      )}

      <VirtualChatList
        {...props}
        onScroll={handleScroll}
      />
    </div>
  );
};

// Hook for virtual chat list management
export const useVirtualChatList = (messages: ChatMessage[]) => {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const handleScroll = useCallback((scrollTop: number, scrollHeight: number, clientHeight: number) => {
    setScrollPosition(scrollTop);
    setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 50);
  }, []);

  const stats = useMemo(() => ({
    totalMessages: messages.length,
    isAtBottom,
    scrollPosition,
    canAutoScroll: isAtBottom,
  }), [messages.length, isAtBottom, scrollPosition]);

  return {
    handleScroll,
    stats,
    isAtBottom,
    scrollPosition,
  };
};

export default VirtualChatList;