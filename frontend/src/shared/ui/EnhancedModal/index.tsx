import React from 'react';
import type { ReactNode } from 'react';
import { FiX } from 'react-icons/fi';
import useModalAnimation from '../../hooks/useModalAnimation';

interface EnhancedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';
  animationType?: 'scale' | 'slide' | 'spring';
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
  enhanced?: boolean;
  footer?: ReactNode;
}

const EnhancedModal: React.FC<EnhancedModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  animationType = 'scale',
  showCloseButton = true,
  closeOnBackdrop = true,
  className = '',
  enhanced = false,
  footer
}) => {
  const {
    isVisible,
    isAnimating,
    modalRef,
    closeModal,
    getOverlayClasses,
    getModalClasses,
    handleKeyDown,
    handleBackdropClick
  } = useModalAnimation({
    isOpen,
    onClose,
    animationType,
    duration: 300
  });

  if (!isVisible) return null;

  const getSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'modal-sm';
      case 'lg':
        return 'modal-lg';
      case 'xl':
        return 'modal-xl';
      case 'fullscreen':
        return 'modal-fullscreen';
      default:
        return '';
    }
  };

  const overlayClasses = `${getOverlayClasses()} ${enhanced ? 'enhanced' : ''}`;
  const modalClasses = `${getModalClasses()} ${getSizeClass()} ${className}`;

  const handleOverlayClick = closeOnBackdrop ? handleBackdropClick : undefined;

  return (
    <div 
      className={overlayClasses}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      aria-describedby={subtitle ? "modal-subtitle" : undefined}
    >
      <div
        ref={modalRef}
        className={modalClasses}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        role="document"
      >
        {/* Header */}
        {(title || subtitle || showCloseButton) && (
          <div className="modal-header">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                {title && (
                  <h2 
                    id="modal-title"
                    className="text-xl font-semibold text-primary truncate"
                  >
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p 
                    id="modal-subtitle"
                    className="text-sm text-secondary mt-1"
                  >
                    {subtitle}
                  </p>
                )}
              </div>
              
              {showCloseButton && (
                <button
                  onClick={closeModal}
                  className="btn-ghost p-2 ml-4 flex-shrink-0 hover:bg-secondary transition-colors"
                  aria-label="Close modal"
                  disabled={isAnimating}
                >
                  <FiX className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="modal-body flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedModal;
