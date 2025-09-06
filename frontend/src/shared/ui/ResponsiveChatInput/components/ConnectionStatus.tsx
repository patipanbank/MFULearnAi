import React from 'react';
import type { ConnectionStatusProps } from '../types/input.types';

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isInChatRoom,
  currentMode
}) => {
  if (currentMode !== 'fixbottom' || !isInChatRoom) return null;

  return (
    <div className="absolute bottom-1 left-4 flex items-center space-x-1 text-xs text-green-600">
      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      <span>Connected</span>
    </div>
  );
};

export default ConnectionStatus;