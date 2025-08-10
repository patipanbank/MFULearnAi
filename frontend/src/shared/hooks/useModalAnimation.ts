import { useEffect, useState, useCallback, useRef } from 'react';

interface UseModalAnimationProps {
  isOpen: boolean;
  onClose: () => void;
  animationType?: 'scale' | 'slide' | 'spring';
  duration?: number;
  mobileSlideUp?: boolean;
}

export const useModalAnimation = ({
  isOpen,
  onClose,
  animationType = 'scale',
  duration = 300,
  mobileSlideUp = true
}: UseModalAnimationProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Track if mobile
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle opening animation
  useEffect(() => {
    if (isOpen && !isVisible) {
      // Store currently focused element
      previouslyFocused.current = document.activeElement as HTMLElement;
      
      setIsVisible(true);
      setIsAnimating(true);
      
      // Focus modal after a brief delay to allow rendering
      setTimeout(() => {
        modalRef.current?.focus();
      }, 50);
      
      // End opening animation
      setTimeout(() => {
        setIsAnimating(false);
      }, duration);
    }
  }, [isOpen, isVisible, duration]);

  // Handle closing animation
  const closeModal = useCallback(() => {
    if (!isVisible) return;
    
    setIsClosing(true);
    setIsAnimating(true);
    
    setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
      setIsAnimating(false);
      
      // Restore focus to previously focused element
      if (previouslyFocused.current) {
        previouslyFocused.current.focus();
        previouslyFocused.current = null;
      }
      
      onClose();
    }, duration * 0.7); // Slightly faster closing
  }, [isVisible, onClose, duration]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible && !isAnimating) {
        closeModal();
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }
  }, [isVisible, isAnimating, closeModal]);

  // Get CSS classes based on animation type and state
  const getOverlayClasses = () => {
    let classes = 'modal-overlay';
    
    if (isClosing) {
      classes += ' closing';
    }
    
    return classes;
  };

  const getModalClasses = () => {
    let classes = 'modal-content';
    
    // Add animation type
    if (animationType === 'spring') {
      classes += ' modal-spring-in';
    } else if (animationType === 'slide' || (isMobile && mobileSlideUp)) {
      classes += ' slide-up';
    }
    
    if (isClosing) {
      classes += ' closing';
    }
    
    return classes;
  };

  // Focus trap for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      const modal = modalRef.current;
      if (!modal) return;

      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    }
  };

  // Backdrop click handler
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isAnimating) {
      closeModal();
    }
  };

  return {
    isVisible,
    isAnimating,
    isClosing,
    isMobile,
    modalRef,
    closeModal,
    getOverlayClasses,
    getModalClasses,
    handleKeyDown,
    handleBackdropClick
  };
};

export default useModalAnimation;
