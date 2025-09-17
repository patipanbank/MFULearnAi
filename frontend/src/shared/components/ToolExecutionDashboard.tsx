import React, { useState, useEffect, useCallback } from 'react';

// ===== INTERFACES =====

interface ToolExecution {
  id: string;
  toolName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  progress: number;
  inputSize: number;
  outputSize?: number;
  error?: string;
  metadata?: Record<string, any>;
}

interface ToolMetrics {
  toolName: string;
  totalExecutions: number;
  successRate: number;
  averageDuration: number;
  lastExecuted: Date;
  errorPatterns: Record<string, number>;
}

interface BatchExecution {
  id: string;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  totalTools: number;
  completedTools: number;
  failedTools: number;
  estimatedCompletion?: Date;
}

interface DashboardProps {
  sessionId?: string;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  className?: string;
}

// ===== MAIN COMPONENT =====

const ToolExecutionDashboard: React.FC<DashboardProps> = ({
  sessionId,
  isMinimized = false,
  onToggleMinimize,
  className = ''
}) => {
  // State
  const [activeExecutions, setActiveExecutions] = useState<ToolExecution[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<ToolExecution[]>([]);
  const [toolMetrics, setToolMetrics] = useState<Record<string, ToolMetrics>>({});
  const [activeBatches, setActiveBatches] = useState<BatchExecution[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'active' | 'history' | 'metrics' | 'batches'>('active');

  // WebSocket for real-time updates
  const [ws, setWs] = useState<WebSocket | null>(null);

  // ===== CONNECTION MANAGEMENT =====

  useEffect(() => {
    if (!sessionId) return;

    const connectWebSocket = () => {
      const wsUrl = `ws://localhost/ws/tool-execution?sessionId=${sessionId}`;
      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        console.log('🔌 Tool execution dashboard connected');
        setIsConnected(true);
        setWs(websocket);
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      websocket.onclose = () => {
        console.log('🔌 Tool execution dashboard disconnected');
        setIsConnected(false);
        setWs(null);

        // Attempt reconnection after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      websocket.onerror = (error) => {
        console.error('Tool execution dashboard WebSocket error:', error);
      };
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [sessionId]);

  // ===== EVENT HANDLERS =====

  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'tool_started':
        handleToolStarted(data.execution);
        break;

      case 'tool_progress':
        handleToolProgress(data.executionId, data.progress);
        break;

      case 'tool_completed':
        handleToolCompleted(data.execution);
        break;

      case 'tool_failed':
        handleToolFailed(data.execution);
        break;

      case 'batch_started':
        handleBatchStarted(data.batch);
        break;

      case 'batch_updated':
        handleBatchUpdated(data.batch);
        break;

      case 'batch_completed':
        handleBatchCompleted(data.batch);
        break;

      case 'metrics_updated':
        handleMetricsUpdated(data.metrics);
        break;

      default:
        console.debug('Unknown tool execution message:', data);
    }
  }, []);

  const handleToolStarted = useCallback((execution: ToolExecution) => {
    setActiveExecutions(prev => {
      const existing = prev.find(e => e.id === execution.id);
      if (existing) return prev;

      return [...prev, {
        ...execution,
        status: 'running',
        progress: 0,
        startTime: new Date(execution.startTime)
      }];
    });
  }, []);

  const handleToolProgress = useCallback((executionId: string, progress: number) => {
    setActiveExecutions(prev =>
      prev.map(execution =>
        execution.id === executionId
          ? { ...execution, progress: Math.min(100, Math.max(0, progress)) }
          : execution
      )
    );
  }, []);

  const handleToolCompleted = useCallback((execution: ToolExecution) => {
    const completedExecution = {
      ...execution,
      status: 'completed' as const,
      endTime: new Date(),
      duration: execution.duration,
      progress: 100
    };

    setActiveExecutions(prev => prev.filter(e => e.id !== execution.id));
    setRecentExecutions(prev => [completedExecution, ...prev.slice(0, 49)]); // Keep last 50
  }, []);

  const handleToolFailed = useCallback((execution: ToolExecution) => {
    const failedExecution = {
      ...execution,
      status: 'failed' as const,
      endTime: new Date(),
      progress: 0
    };

    setActiveExecutions(prev => prev.filter(e => e.id !== execution.id));
    setRecentExecutions(prev => [failedExecution, ...prev.slice(0, 49)]);
  }, []);

  const handleBatchStarted = useCallback((batch: BatchExecution) => {
    setActiveBatches(prev => [...prev, {
      ...batch,
      startTime: new Date(batch.startTime)
    }]);
  }, []);

  const handleBatchUpdated = useCallback((batch: BatchExecution) => {
    setActiveBatches(prev =>
      prev.map(b => b.id === batch.id ? { ...batch, startTime: new Date(batch.startTime) } : b)
    );
  }, []);

  const handleBatchCompleted = useCallback((batch: BatchExecution) => {
    setActiveBatches(prev => prev.filter(b => b.id !== batch.id));
  }, []);

  const handleMetricsUpdated = useCallback((metrics: Record<string, ToolMetrics>) => {
    setToolMetrics(prev => ({ ...prev, ...metrics }));
  }, []);

  // ===== UTILITY FUNCTIONS =====

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'timeout': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getProgressColor = (progress: number): string => {
    if (progress < 30) return 'bg-red-500';
    if (progress < 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // ===== RENDER COMPONENTS =====

  const renderActiveExecutions = () => (
    <div className="space-y-3">
      {activeExecutions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-lg mb-2">🔧</div>
          <p>No active tool executions</p>
        </div>
      ) : (
        activeExecutions.map(execution => (
          <div
            key={execution.id}
            className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="font-medium text-gray-900">{execution.toolName}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                  {execution.status}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {formatDuration(Date.now() - execution.startTime.getTime())}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-2">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Progress</span>
                <span>{execution.progress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(execution.progress)}`}
                  style={{ width: `${execution.progress}%` }}
                />
              </div>
            </div>

            {/* Metadata */}
            {execution.metadata && (
              <div className="text-xs text-gray-500 flex space-x-4">
                <span>Input: {execution.inputSize} bytes</span>
                {execution.outputSize && <span>Output: {execution.outputSize} bytes</span>}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  const renderExecutionHistory = () => (
    <div className="space-y-2">
      {recentExecutions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-lg mb-2">📜</div>
          <p>No execution history</p>
        </div>
      ) : (
        recentExecutions.map(execution => (
          <div
            key={execution.id}
            className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">{execution.toolName}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                  {execution.status}
                </span>
              </div>
              <div className="text-right text-sm text-gray-500">
                {execution.duration && <div>{formatDuration(execution.duration)}</div>}
                <div>{execution.endTime?.toLocaleTimeString()}</div>
              </div>
            </div>

            {execution.error && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                {execution.error}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  const renderToolMetrics = () => (
    <div className="space-y-3">
      {Object.values(toolMetrics).length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-lg mb-2">📊</div>
          <p>No metrics available</p>
        </div>
      ) : (
        Object.values(toolMetrics).map(metric => (
          <div
            key={metric.toolName}
            className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">{metric.toolName}</h3>
              <span className="text-sm text-gray-500">
                {metric.totalExecutions} executions
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Success Rate</span>
                <div className="font-medium text-green-600">
                  {(metric.successRate * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <span className="text-gray-600">Avg Duration</span>
                <div className="font-medium">
                  {formatDuration(metric.averageDuration)}
                </div>
              </div>
            </div>

            {Object.keys(metric.errorPatterns).length > 0 && (
              <div className="mt-3">
                <span className="text-sm text-gray-600">Common Errors:</span>
                <div className="mt-1 space-y-1">
                  {Object.entries(metric.errorPatterns)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 3)
                    .map(([error, count]) => (
                      <div key={error} className="text-xs text-red-600 flex justify-between">
                        <span>{error}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  const renderBatchExecutions = () => (
    <div className="space-y-3">
      {activeBatches.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-lg mb-2">📦</div>
          <p>No active batches</p>
        </div>
      ) : (
        activeBatches.map(batch => (
          <div
            key={batch.id}
            className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">Batch {batch.id.slice(0, 8)}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(batch.status)}`}>
                  {batch.status}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {formatDuration(Date.now() - batch.startTime.getTime())}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Tools</span>
                <div className="font-medium">{batch.totalTools}</div>
              </div>
              <div>
                <span className="text-gray-600">Completed</span>
                <div className="font-medium text-green-600">{batch.completedTools}</div>
              </div>
              <div>
                <span className="text-gray-600">Failed</span>
                <div className="font-medium text-red-600">{batch.failedTools}</div>
              </div>
            </div>

            {/* Batch Progress */}
            <div className="mt-3">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Progress</span>
                <span>{Math.round((batch.completedTools / batch.totalTools) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${(batch.completedTools / batch.totalTools) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  // ===== MAIN RENDER =====

  if (isMinimized) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">Tool Execution</span>
              {activeExecutions.length > 0 && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  {activeExecutions.length} active
                </span>
              )}
            </div>
            {onToggleMinimize && (
              <button
                onClick={onToggleMinimize}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <h2 className="text-lg font-semibold text-gray-900">Tool Execution Dashboard</h2>
          </div>
          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-4">
          {[
            { key: 'active', label: 'Active', count: activeExecutions.length },
            { key: 'history', label: 'History', count: recentExecutions.length },
            { key: 'metrics', label: 'Metrics', count: Object.keys(toolMetrics).length },
            { key: 'batches', label: 'Batches', count: activeBatches.length }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key as any)}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                selectedTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {selectedTab === 'active' && renderActiveExecutions()}
        {selectedTab === 'history' && renderExecutionHistory()}
        {selectedTab === 'metrics' && renderToolMetrics()}
        {selectedTab === 'batches' && renderBatchExecutions()}
      </div>

      {/* Status Bar */}
      <div className="border-t border-gray-200 px-4 py-2 bg-gray-50 text-xs text-gray-500">
        {isConnected ? 'Connected' : 'Disconnected'} •
        Last update: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};

export default ToolExecutionDashboard;