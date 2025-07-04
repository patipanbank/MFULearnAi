import React from 'react';

interface ToolUsage {
  type: 'tool_start' | 'tool_result' | 'tool_error';
  tool_name: string;
  tool_input?: string;
  output?: string;
  error?: string;
  timestamp: Date;
}

interface ToolUsageDisplayProps {
  toolUsage: ToolUsage[];
}

export const ToolUsageDisplay: React.FC<ToolUsageDisplayProps> = ({ toolUsage }) => {
  if (!toolUsage || toolUsage.length === 0) {
    return null;
  }

  const getToolIcon = (toolName: string) => {
    if (toolName.includes('search_')) {
      return '🔍';
    }
    return '🔧';
  };

  const getToolDisplayName = (toolName: string) => {
    if (toolName.startsWith('search_')) {
      return `ค้นหาข้อมูลจาก ${toolName.replace('search_', '')}`;
    }
    return toolName;
  };

  return (
    <div className="mt-2 space-y-2">
      {toolUsage.map((usage, index) => (
        <div key={index} className="bg-gray-50 rounded-lg p-3 border-l-4 border-blue-500">
          {usage.type === 'tool_start' && (
            <div className="flex items-center space-x-2">
              <span className="text-lg">{getToolIcon(usage.tool_name)}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-700">
                  {getToolDisplayName(usage.tool_name)}
                </div>
                {usage.tool_input && (
                  <div className="text-xs text-gray-500 mt-1">
                    ค้นหา: "{usage.tool_input}"
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-400">
                {usage.timestamp.toLocaleTimeString()}
              </div>
            </div>
          )}
          
          {usage.type === 'tool_result' && (
            <div className="flex items-start space-x-2">
              <span className="text-lg">✅</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-700">
                  ผลลัพธ์จาก {getToolDisplayName(usage.tool_name)}
                </div>
                {usage.output && (
                  <div className="text-xs text-gray-600 mt-1 bg-white p-2 rounded border">
                    {usage.output.length > 200 
                      ? `${usage.output.substring(0, 200)}...` 
                      : usage.output
                    }
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-400">
                {usage.timestamp.toLocaleTimeString()}
              </div>
            </div>
          )}
          
          {usage.type === 'tool_error' && (
            <div className="flex items-center space-x-2">
              <span className="text-lg">❌</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-red-700">
                  เกิดข้อผิดพลาดใน {getToolDisplayName(usage.tool_name)}
                </div>
                {usage.error && (
                  <div className="text-xs text-red-600 mt-1">
                    {usage.error}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-400">
                {usage.timestamp.toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}; 