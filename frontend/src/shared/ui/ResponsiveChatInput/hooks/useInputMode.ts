import { useState, useEffect } from 'react';

export const useInputMode = () => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentMode, setCurrentMode] = useState<'floating' | 'fixbottom'>('floating');

  // Always use fixbottom mode for now
  const targetMode = 'fixbottom';

  // Handle mode transition with animation
  useEffect(() => {
    if (targetMode !== currentMode) {
      setIsTransitioning(true);
      
      const timer = setTimeout(() => {
        setCurrentMode(targetMode);
        
        const completeTimer = setTimeout(() => {
          setIsTransitioning(false);
        }, 300);
        
        return () => clearTimeout(completeTimer);
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [targetMode, currentMode]);

  return {
    currentMode,
    isTransitioning,
    targetMode
  };
};