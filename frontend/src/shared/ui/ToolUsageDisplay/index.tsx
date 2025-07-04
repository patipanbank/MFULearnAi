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
  // แสดงเฉพาะตอนมี tool_start และยังไม่มี tool_result/tool_error
  const isActive = toolUsage.some(u => u.type === 'tool_start') &&
    !toolUsage.some(u => u.type === 'tool_result' || u.type === 'tool_error');
  if (!isActive) return null;
  return (
    <div className="mt-1 text-blue-600 flex items-center text-sm">
      <span className="mr-1">🔍</span> กำลังใช้เครื่องมือค้นหาข้อมูล...
    </div>
  );
}; 