import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import './styles.css';

export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
export type ModalHeight = 'auto' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

export type ModalType =
  | 'create-collection'
  | 'edit-collection'
  | 'upload-documents'
  | 'collection-detail'
  | 'agent-config'
  | 'settings'
  | 'advanced-settings'
  | 'user-management'
  | 'analytics'
  | 'department-management'
  | 'account'
  | 'preferences';

interface UniversalModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;

  // Content-based sizing
  modalType?: ModalType;
  size?: ModalSize;
  height?: ModalHeight;

  // Header
  title?: string;
  subtitle?: string;
  showCloseButton?: boolean;
  headerIcon?: React.ReactNode;

  // Behavior
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  preventBodyScroll?: boolean;

  // Visual
  blur?: boolean;
  className?: string;
  overlayClassName?: string;

  // Mobile
  mobileFullHeight?: boolean;
  mobileSlideUp?: boolean;

  // Accessibility
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

const MODAL_CONFIGS: Record<ModalType, { size: ModalSize; height: ModalHeight; mobileFullHeight?: boolean }> = {
  // Form-based modals (small)
  'create-collection': { size: 'sm', height: 'auto' },
  'edit-collection': { size: 'sm', height: 'auto' },

  // Configuration modals (medium-large)
  'agent-config': { size: 'xl', height: 'lg', mobileFullHeight: true },
  'settings': { size: 'xl', height: 'lg', mobileFullHeight: true },
  'advanced-settings': { size: 'lg', height: 'md' },
  'account': { size: 'lg', height: 'md' },
  'preferences': { size: 'lg', height: 'md' },

  // Data-heavy modals (large)
  'user-management': { size: '3xl', height: 'full', mobileFullHeight: true },
  'analytics': { size: '2xl', height: 'lg', mobileFullHeight: true },
  'department-management': { size: '2xl', height: 'lg', mobileFullHeight: true },
  'collection-detail': { size: '2xl', height: 'lg', mobileFullHeight: true },

  // Upload/process modals
  'upload-documents': { size: 'lg', height: 'lg', mobileFullHeight: true },
};

const SIZE_CLASSES: Record<ModalSize, string> = {
  xs: 'max-w-sm',     // 384px
  sm: 'max-w-md',     // 448px
  md: 'max-w-lg',     // 512px
  lg: 'max-w-2xl',    // 672px
  xl: 'max-w-4xl',    // 896px
  '2xl': 'max-w-6xl', // 1152px
  '3xl': 'max-w-7xl', // 1280px
  full: 'max-w-none'  // Full width
};

const HEIGHT_CLASSES: Record<ModalHeight, string> = {
  auto: 'max-h-none',
  sm: 'max-h-[60vh]',
  md: 'max-h-[75vh]',
  lg: 'max-h-[85vh]',
  xl: 'max-h-[90vh]',
  full: 'max-h-[95vh]'
};

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
};

const UniversalModal: React.FC<UniversalModalProps> = ({
  isOpen,
  onClose,
  children,
  modalType,
  size: customSize,
  height: customHeight,
  title,
  subtitle,
  showCloseButton = true,
  headerIcon,
  closeOnOutsideClick = true,
  closeOnEscape = true,
  preventBodyScroll = true,
  blur = true,
  className = '',
  overlayClassName = '',
  mobileFullHeight: customMobileFullHeight,
  mobileSlideUp = true,
  ariaLabelledBy,
  ariaDescribedBy,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Get modal configuration
  const config = modalType ? MODAL_CONFIGS[modalType] : { size: 'lg' as ModalSize, height: 'lg' as ModalHeight };
  const finalSize = customSize || config.size;
  const finalHeight = customHeight || config.height;
  const shouldMobileFullHeight = customMobileFullHeight ?? config.mobileFullHeight ?? false;

  // Generate modal classes
  const getModalClasses = useCallback(() => {
    if (isMobile) {
      if (shouldMobileFullHeight) {
        return `w-full h-full max-w-none max-h-none ${mobileSlideUp ? 'rounded-t-xl' : 'rounded-none'}`;
      }
      return `w-full mx-4 max-h-[85vh] rounded-lg`;
    }

    const sizeClass = SIZE_CLASSES[finalSize];
    const heightClass = HEIGHT_CLASSES[finalHeight];
    const responsiveMargin = ['2xl', '3xl', 'full'].includes(finalSize) ? 'mx-8' : 'mx-6';

    return `${sizeClass} ${heightClass} w-full ${responsiveMargin}`;
  }, [isMobile, finalSize, finalHeight, shouldMobileFullHeight, mobileSlideUp]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [isOpen, closeOnEscape, onClose]);

  // Handle body scroll lock
  useEffect(() => {
    if (!isOpen || !preventBodyScroll) return;

    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen, preventBodyScroll]);

  // Focus management
  useEffect(() => {
    if (!isOpen) return;

    // Store current focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus modal
    const timer = setTimeout(() => {
      modalRef.current?.focus();
    }, 100);

    return () => {
      clearTimeout(timer);
      // Restore focus when modal closes
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (!closeOnOutsideClick) return;

    if (event.target === event.currentTarget) {
      onClose();
    }
  }, [closeOnOutsideClick, onClose]);

  // Handle focus trap
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'Tab') return;

    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (!focusableElements || focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }, []);

  if (!isOpen) return null;

  const modal = (
    <div
      className={`
        universal-modal-overlay animate-backdrop-in
        fixed inset-0 flex z-50 p-4
        ${blur ? 'blur-heavy' : ''}
        ${isMobile && mobileSlideUp ? 'items-end' : 'items-center justify-center'}
        ${overlayClassName}
      `}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
    >
      <div
        ref={modalRef}
        className={`
          universal-modal-content
          rounded-lg overflow-hidden
          ${getModalClasses()}
          ${className}
          ${isMobile && mobileSlideUp ? 'animate-slide-up mobile-full-height' : 'animate-fade-in'}
          ${isMobile && !shouldMobileFullHeight ? 'mobile-standard' : ''}
        `}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="universal-modal-header flex items-center justify-between p-6">
            <div className="flex items-center space-x-3">
              {headerIcon && (
                <div className="flex-shrink-0">
                  {headerIcon}
                </div>
              )}
              <div>
                {title && (
                  <h2
                    id={ariaLabelledBy || 'modal-title'}
                    className="text-xl font-semibold text-primary"
                  >
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-sm text-secondary mt-1">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {showCloseButton && (
              <button
                onClick={onClose}
                className="universal-modal-close p-2 rounded-lg flex-shrink-0"
                aria-label="Close modal"
              >
                <FiX className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div
          className={`
            flex-1 overflow-y-auto
            ${finalHeight === 'auto' ? '' : 'flex flex-col'}
          `}
          id={ariaDescribedBy || 'modal-content'}
        >
          {children}
        </div>
      </div>
    </div>
  );

  // Use portal to render at document.body
  return createPortal(modal, document.body);
};

export default UniversalModal;