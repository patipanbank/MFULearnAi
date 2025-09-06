import { cn } from '../../../lib/utils';
import useLayoutStore from '../../../stores/layoutStore';

// Container styles based on mode and device
export const getContainerClasses = (
  currentMode: 'floating' | 'fixbottom',
  isTransitioning: boolean,
  isMobile: boolean
) => {
  const baseClasses = cn(
    'transition-all duration-500 ease-in-out z-[5]',
    'transform-gpu',
    isTransitioning && 'transition-transform transition-opacity duration-500'
  );
  
  if (isMobile) {
    if (currentMode === 'floating') {
      return cn(
        baseClasses,
        'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        'w-[calc(100vw-2rem)] max-w-none',
        'border border-primary rounded-2xl shadow-2xl',
        'backdrop-blur-sm bg-background/95',
        isTransitioning ? 'opacity-90 scale-95' : 'opacity-100 scale-100'
      );
    } else {
      return cn(
        baseClasses,
        'fixed bottom-4 left-1/2 -translate-x-1/2',
        'w-[calc(100vw-2rem)] max-w-none',
        'border border-primary rounded-2xl shadow-lg',
        'bg-background',
        isTransitioning ? 'opacity-90 translate-y-2' : 'opacity-100 translate-y-0'
      );
    }
  } else {
    if (currentMode === 'floating') {
      return cn(
        baseClasses,
        'fixed top-1/2 -translate-x-1/2 -translate-y-1/2',
        'w-full max-w-2xl',
        'rounded-2xl shadow-2xl',
        'backdrop-blur-sm bg-background/95 border border-primary',
        isTransitioning ? 'opacity-90 scale-95' : 'opacity-100 scale-100'
      );
    } else {
      return cn(
        baseClasses,
        'fixed bottom-8 -translate-x-1/2',
        'w-full max-w-2xl',
        'rounded-2xl shadow-lg',
        'bg-background border border-primary',
        isTransitioning ? 'opacity-90 translate-y-2' : 'opacity-100 translate-y-0'
      );
    }
  }
};

// Container style for dynamic positioning
export const getContainerStyle = (isMobile: boolean): React.CSSProperties => {
  if (isMobile) return {};
  
  const { sidebarCollapsed, sidebarHovered } = useLayoutStore.getState();
  const showExpandedContent = !sidebarCollapsed || sidebarHovered;
  const sidebarWidth = showExpandedContent ? 256 : 64;
  const leftPosition = `calc(${sidebarWidth}px + (100vw - ${sidebarWidth}px) / 2)`;
  
  return {
    left: leftPosition,
    transition: 'left 300ms ease-in-out'
  };
};

// Card styling based on mode
export const getCardClasses = (currentMode: 'floating' | 'fixbottom') => {
  return cn(
    'transition-all duration-300',
    currentMode === 'floating' 
      ? 'p-6 backdrop-blur-md' 
      : 'p-4',
    currentMode === 'floating' && 'shadow-xl shadow-primary/20'
  );
};