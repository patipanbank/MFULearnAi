import React, { useEffect, useRef } from 'react';
import { useChatStateStore } from '../../store/chatStateStore';
import { useChatActionsStore } from '../../store/chatActionsStore';
import ChatInput from './ui/ChatInput';
import ChatBubble from './ui/ChatBubble';
import ModelSelector from './ui/ModelSelector';

export const ChatManager: React.FC = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const {
    messages,
    models,
    selectedModel,
    isLoading,
    setMessages,
    setSelectedModel,
    setIsLoading,
    fetchModels,
    fetchUsage
  } = useChatStateStore();

  const {
    handleSubmit,
    handleContinueClick,
    handleKeyDown,
    handlePaste,
    shouldAutoScroll,
    setWsRef,
    setUserScrolledManually,
  } = useChatActionsStore();

  useEffect(() => {
    fetchModels();
    fetchUsage();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [fetchModels, fetchUsage]);

  useEffect(() => {
    if (wsRef.current) {
      setWsRef(wsRef.current);
    }
  }, [setWsRef]);

  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, shouldAutoScroll]);

  const handleScrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50;
      if (!isAtBottom) {
        setUserScrolledManually(true);
      }
    }
  };

  const handleWebSocketMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'message') {
        const updatedMessages = [...messages];
        const lastMessage = updatedMessages[updatedMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.isComplete) {
          updatedMessages[updatedMessages.length - 1] = {
            ...lastMessage,
            content: data.content,
            images: data.images || [],
            sources: data.sources || [],
            isComplete: data.isComplete
          };
          setMessages(updatedMessages);
        }
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  };

  const handleWebSocketError = (error: Event) => {
    console.error('WebSocket error:', error);
    setIsLoading(false);
  };

  const handleWebSocketClose = () => {
    console.log('WebSocket closed');
    setIsLoading(false);
  };

  useEffect(() => {
    const ws = new WebSocket(process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws');
    wsRef.current = ws;

    ws.onmessage = handleWebSocketMessage;
    ws.onerror = handleWebSocketError;
    ws.onclose = handleWebSocketClose;

    return () => {
      ws.close();
    };
  }, []);

  const isNearBottom = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      return Math.abs(scrollHeight - scrollTop - clientHeight) < 100;
    }
    return false;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none p-4 border-b">
        <ModelSelector 
          models={models} 
          selectedModel={selectedModel} 
          setSelectedModel={setSelectedModel} 
        />
      </div>
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onScroll={handleScroll}
      >
        {messages.map((message, index) => (
          <ChatBubble
            key={message.id}
            message={message}
            isLastMessage={index === messages.length - 1}
            isLoading={isLoading}
            onContinueClick={handleContinueClick}
            selectedModel={selectedModel}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex-none p-4 border-t">
        <ChatInput
          handleSubmit={handleSubmit}
          handleKeyDown={handleKeyDown}
          handlePaste={handlePaste}
          models={models}
          handleScrollToBottom={handleScrollToBottom}
          isNearBottom={isNearBottom()}
        />
      </div>
    </div>
  );
}; 