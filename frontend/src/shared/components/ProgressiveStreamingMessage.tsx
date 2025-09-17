import React, { useState, useEffect, useCallback, useRef } from 'react';

// ===== INTERFACES =====

interface StreamingChunk {
  id: string;
  type: 'text' | 'tool_start' | 'tool_result' | 'tool_error' | 'thinking' | 'citation' | 'summary';
  content: string;
  metadata?: {
    toolName?: string;
    confidence?: number;
    source?: string;
    timestamp?: string;
    isPartial?: boolean;
  };
  timestamp: Date;
  order: number;
}

interface ProgressiveMessage {
  id: string;
  chunks: StreamingChunk[];
  isComplete: boolean;
  totalEstimatedChunks?: number;
  processingStage: 'thinking' | 'tool_execution' | 'generation' | 'enhancement' | 'complete';
  quality: {
    confidence: number;
    completeness: number;
    relevance: number;
  };
}

interface ProgressiveStreamingProps {
  messageId: string;
  sessionId: string;
  initialContent?: string;
  onMessageComplete?: (content: string) => void;
  onToolExecution?: (toolName: string, status: 'start' | 'result' | 'error') => void;
  className?: string;
}

// ===== MAIN COMPONENT =====

const ProgressiveStreamingMessage: React.FC<ProgressiveStreamingProps> = ({
  messageId,
  sessionId,
  initialContent = '',
  onMessageComplete,
  onToolExecution,
  className = ''
}) => {
  // State
  const [message, setMessage] = useState<ProgressiveMessage>({
    id: messageId,
    chunks: [],
    isComplete: false,
    processingStage: 'thinking',
    quality: { confidence: 0, completeness: 0, relevance: 0 }
  });

  const [isVisible, setIsVisible] = useState(false);
  const [currentTypingChunk, setCurrentTypingChunk] = useState<string>('');
  const [typingSpeed] = useState(50); // ms per character
  const [showThinking, setShowThinking] = useState(true);

  // Refs
  const messageRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const lastChunkIndexRef = useRef<number>(-1);

  // WebSocket for real-time streaming
  const [ws, setWs] = useState<WebSocket | null>(null);

  // ===== EFFECTS =====

  // Initialize streaming connection
  useEffect(() => {
    if (!sessionId || !messageId) return;

    const connectStreaming = () => {
      const wsUrl = `ws://localhost/ws/streaming?sessionId=${sessionId}&messageId=${messageId}`;
      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        console.log(`🔗 Streaming connected for message ${messageId}`);
        setWs(websocket);
        setIsVisible(true);
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleStreamingMessage(data);
        } catch (error) {
          console.error('Failed to parse streaming message:', error);
        }
      };

      websocket.onclose = () => {
        console.log(`📡 Streaming disconnected for message ${messageId}`);
        setWs(null);
      };

      websocket.onerror = (error) => {
        console.error('Streaming WebSocket error:', error);
      };
    };

    connectStreaming();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [sessionId, messageId]);

  // Initialize with existing content
  useEffect(() => {
    if (initialContent && message.chunks.length === 0) {
      const initialChunk: StreamingChunk = {
        id: 'initial',
        type: 'text',
        content: initialContent,
        timestamp: new Date(),
        order: 0
      };

      setMessage(prev => ({
        ...prev,
        chunks: [initialChunk],
        isComplete: true,
        processingStage: 'complete'
      }));
    }
  }, [initialContent]);

  // Auto-scroll to message when chunks are added
  useEffect(() => {
    if (messageRef.current && message.chunks.length > lastChunkIndexRef.current) {
      messageRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      lastChunkIndexRef.current = message.chunks.length;
    }
  }, [message.chunks.length]);

  // ===== STREAMING HANDLERS =====

  const handleStreamingMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'chunk_received':
        handleChunkReceived(data.chunk);
        break;

      case 'processing_stage_update':
        handleProcessingStageUpdate(data.stage, data.metadata);
        break;

      case 'tool_execution_start':
        handleToolExecutionStart(data.toolName, data.metadata);
        break;

      case 'tool_execution_result':
        handleToolExecutionResult(data.toolName, data.result, data.metadata);
        break;

      case 'tool_execution_error':
        handleToolExecutionError(data.toolName, data.error, data.metadata);
        break;

      case 'quality_update':
        handleQualityUpdate(data.quality);
        break;

      case 'message_complete':
        handleMessageComplete(data.finalContent, data.quality);
        break;

      case 'thinking_update':
        handleThinkingUpdate(data.thought);
        break;

      default:
        console.debug('Unknown streaming message type:', data.type);
    }
  }, []);

  const handleChunkReceived = useCallback((chunkData: any) => {
    const chunk: StreamingChunk = {
      id: chunkData.id || `chunk_${Date.now()}`,
      type: chunkData.type || 'text',
      content: chunkData.content || '',
      metadata: chunkData.metadata,
      timestamp: new Date(chunkData.timestamp || Date.now()),
      order: chunkData.order || message.chunks.length
    };

    setMessage(prev => {
      const existingChunkIndex = prev.chunks.findIndex(c => c.id === chunk.id);

      if (existingChunkIndex >= 0) {
        // Update existing chunk
        const updatedChunks = [...prev.chunks];
        updatedChunks[existingChunkIndex] = {
          ...updatedChunks[existingChunkIndex],
          content: chunk.content,
          metadata: { ...updatedChunks[existingChunkIndex].metadata, ...chunk.metadata }
        };

        return { ...prev, chunks: updatedChunks };
      } else {
        // Add new chunk
        const newChunks = [...prev.chunks, chunk].sort((a, b) => a.order - b.order);
        return { ...prev, chunks: newChunks };
      }
    });

    // Start typing animation for text chunks
    if (chunk.type === 'text' && chunk.content) {
      startTypingAnimation(chunk.content);
    }
  }, [message.chunks.length]);

  const handleProcessingStageUpdate = useCallback((stage: string, metadata: any) => {
    setMessage(prev => ({
      ...prev,
      processingStage: stage as ProgressiveMessage['processingStage'],
      totalEstimatedChunks: metadata?.estimatedChunks
    }));

    // Update thinking visibility
    setShowThinking(stage === 'thinking' || stage === 'tool_execution');
  }, []);

  const handleToolExecutionStart = useCallback((toolName: string, metadata: any) => {
    const toolChunk: StreamingChunk = {
      id: `tool_start_${toolName}_${Date.now()}`,
      type: 'tool_start',
      content: `Executing ${toolName}...`,
      metadata: { toolName, ...metadata },
      timestamp: new Date(),
      order: message.chunks.length
    };

    setMessage(prev => ({
      ...prev,
      chunks: [...prev.chunks, toolChunk]
    }));

    onToolExecution?.(toolName, 'start');
  }, [message.chunks.length, onToolExecution]);

  const handleToolExecutionResult = useCallback((toolName: string, result: any, metadata: any) => {
    const toolChunk: StreamingChunk = {
      id: `tool_result_${toolName}_${Date.now()}`,
      type: 'tool_result',
      content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      metadata: { toolName, ...metadata },
      timestamp: new Date(),
      order: message.chunks.length
    };

    setMessage(prev => ({
      ...prev,
      chunks: [...prev.chunks, toolChunk]
    }));

    onToolExecution?.(toolName, 'result');
  }, [message.chunks.length, onToolExecution]);

  const handleToolExecutionError = useCallback((toolName: string, error: string, metadata: any) => {
    const errorChunk: StreamingChunk = {
      id: `tool_error_${toolName}_${Date.now()}`,
      type: 'tool_error',
      content: error,
      metadata: { toolName, ...metadata },
      timestamp: new Date(),
      order: message.chunks.length
    };

    setMessage(prev => ({
      ...prev,
      chunks: [...prev.chunks, errorChunk]
    }));

    onToolExecution?.(toolName, 'error');
  }, [message.chunks.length, onToolExecution]);

  const handleQualityUpdate = useCallback((quality: any) => {
    setMessage(prev => ({
      ...prev,
      quality: {
        confidence: quality.confidence || prev.quality.confidence,
        completeness: quality.completeness || prev.quality.completeness,
        relevance: quality.relevance || prev.quality.relevance
      }
    }));
  }, []);

  const handleMessageComplete = useCallback((finalContent: string, quality: any) => {
    setMessage(prev => ({
      ...prev,
      isComplete: true,
      processingStage: 'complete',
      quality: quality || prev.quality
    }));

    setShowThinking(false);
    setCurrentTypingChunk('');

    onMessageComplete?.(finalContent);
  }, [onMessageComplete]);

  const handleThinkingUpdate = useCallback((thought: string) => {
    const thinkingChunk: StreamingChunk = {
      id: `thinking_${Date.now()}`,
      type: 'thinking',
      content: thought,
      timestamp: new Date(),
      order: -1 // Always show thinking at the top
    };

    setMessage(prev => {
      const nonThinkingChunks = prev.chunks.filter(c => c.type !== 'thinking');
      return {
        ...prev,
        chunks: [thinkingChunk, ...nonThinkingChunks]
      };
    });
  }, []);

  // ===== TYPING ANIMATION =====

  const startTypingAnimation = useCallback((content: string) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    let currentIndex = 0;
    const typeNextCharacter = () => {
      if (currentIndex < content.length) {
        setCurrentTypingChunk(content.substring(0, currentIndex + 1));
        currentIndex++;

        typingTimeoutRef.current = setTimeout(typeNextCharacter, typingSpeed);
      } else {
        setCurrentTypingChunk('');
      }
    };

    typeNextCharacter();
  }, [typingSpeed]);

  // ===== RENDER HELPERS =====

  const renderChunk = (chunk: StreamingChunk) => {
    switch (chunk.type) {
      case 'text':
        return (
          <div key={chunk.id} className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap">
              {chunk.content}
              {currentTypingChunk && chunk.id === message.chunks[message.chunks.length - 1]?.id && (
                <span className="animate-pulse">▊</span>
              )}
            </div>
          </div>
        );

      case 'thinking':
        return showThinking ? (
          <div key={chunk.id} className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-3 rounded-r">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-blue-700 text-sm font-medium">Thinking...</span>
            </div>
            <div className="text-blue-600 text-sm mt-1 italic">
              {chunk.content}
            </div>
          </div>
        ) : null;

      case 'tool_start':
        return (
          <div key={chunk.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-spin" />
              <span className="text-yellow-800 text-sm font-medium">
                🔧 {chunk.metadata?.toolName || 'Tool'} Execution
              </span>
            </div>
            {chunk.content && (
              <div className="text-yellow-700 text-sm mt-1">
                {chunk.content}
              </div>
            )}
          </div>
        );

      case 'tool_result':
        return (
          <div key={chunk.id} className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-green-800 text-sm font-medium">
                ✅ {chunk.metadata?.toolName || 'Tool'} Result
              </span>
            </div>
            <div className="text-green-700 text-sm mt-1 bg-white p-2 rounded border">
              <pre className="whitespace-pre-wrap font-mono text-xs">
                {chunk.content}
              </pre>
            </div>
          </div>
        );

      case 'tool_error':
        return (
          <div key={chunk.id} className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span className="text-red-800 text-sm font-medium">
                ❌ {chunk.metadata?.toolName || 'Tool'} Error
              </span>
            </div>
            <div className="text-red-700 text-sm mt-1 bg-white p-2 rounded border">
              {chunk.content}
            </div>
          </div>
        );

      case 'citation':
        return (
          <div key={chunk.id} className="bg-purple-50 border-l-4 border-purple-400 p-2 mb-2">
            <div className="text-purple-700 text-xs">
              📚 Source: {chunk.metadata?.source || 'Unknown'}
            </div>
            {chunk.content && (
              <div className="text-purple-600 text-sm mt-1">
                {chunk.content}
              </div>
            )}
          </div>
        );

      case 'summary':
        return (
          <div key={chunk.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2">
            <div className="text-gray-700 text-sm font-medium mb-1">
              📋 Summary
            </div>
            <div className="text-gray-600 text-sm">
              {chunk.content}
            </div>
          </div>
        );

      default:
        return (
          <div key={chunk.id} className="text-gray-600 text-sm">
            {chunk.content}
          </div>
        );
    }
  };

  const renderProcessingIndicator = () => {
    if (message.isComplete) return null;

    const stageInfo = {
      thinking: { icon: '🤔', label: 'Thinking', color: 'blue' },
      tool_execution: { icon: '🔧', label: 'Using Tools', color: 'yellow' },
      generation: { icon: '✍️', label: 'Generating', color: 'green' },
      enhancement: { icon: '✨', label: 'Enhancing', color: 'purple' },
      complete: { icon: '✅', label: 'Complete', color: 'green' }
    };

    const stage = stageInfo[message.processingStage] || stageInfo.thinking;

    return (
      <div className={`bg-${stage.color}-50 border border-${stage.color}-200 rounded-lg p-3 mb-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{stage.icon}</span>
            <span className={`text-${stage.color}-800 text-sm font-medium`}>
              {stage.label}
            </span>
          </div>
          {message.totalEstimatedChunks && (
            <div className={`text-${stage.color}-600 text-xs`}>
              {message.chunks.filter(c => c.type === 'text').length} / {message.totalEstimatedChunks}
            </div>
          )}
        </div>

        {/* Progress bar */}
        {message.totalEstimatedChunks && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className={`bg-${stage.color}-500 h-1.5 rounded-full transition-all duration-300`}
                style={{
                  width: `${Math.min(100, (message.chunks.filter(c => c.type === 'text').length / message.totalEstimatedChunks) * 100)}%`
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderQualityIndicator = () => {
    if (message.quality.confidence === 0) return null;

    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 mb-2">
        <div className="text-gray-600 text-xs font-medium mb-2">Response Quality</div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-gray-500">Confidence</div>
            <div className="font-medium text-blue-600">
              {(message.quality.confidence * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <div className="text-gray-500">Completeness</div>
            <div className="font-medium text-green-600">
              {(message.quality.completeness * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <div className="text-gray-500">Relevance</div>
            <div className="font-medium text-purple-600">
              {(message.quality.relevance * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ===== MAIN RENDER =====

  if (!isVisible) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="bg-gray-200 rounded-lg p-4">
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div ref={messageRef} className={`space-y-2 ${className}`}>
      {/* Processing Indicator */}
      {renderProcessingIndicator()}

      {/* Quality Indicator */}
      {renderQualityIndicator()}

      {/* Message Chunks */}
      <div className="space-y-2">
        {message.chunks
          .filter(chunk => chunk.type !== 'thinking' || showThinking)
          .map(chunk => renderChunk(chunk))}
      </div>

      {/* Typing Indicator */}
      {currentTypingChunk && (
        <div className="prose prose-sm max-w-none">
          <div className="whitespace-pre-wrap">
            {currentTypingChunk}
            <span className="animate-pulse">▊</span>
          </div>
        </div>
      )}

      {/* Completion Indicator */}
      {message.isComplete && (
        <div className="text-gray-400 text-xs text-right">
          ✓ Message complete
        </div>
      )}
    </div>
  );
};

export default ProgressiveStreamingMessage;