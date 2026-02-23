import { onMounted, onUnmounted, nextTick } from 'vue'

/**
 * Composable to add keyboard support to modals.
 *
 * Features:
 *  - Escape  → close the modal
 *  - Enter   → trigger the primary action (optional)
 *  - Tab     → trap focus within the modal
 *
 * @param {Object} options
 * @param {Function}        options.onClose          - Called when Escape is pressed
 * @param {Function|null}   [options.onConfirm]      - Called when Enter is pressed (if not inside textarea/select)
 * @param {Function|null}   [options.modalRef]        - Ref to the modal container element (for focus trapping)
 * @param {boolean}         [options.trapFocus=true]  - Whether to trap Tab focus inside the modal
 * @param {boolean}         [options.closeOnEscape=true]
 */
export function useModalKeyboard(options = {}) {
  const {
    onClose,
    onConfirm = null,
    modalRef = null,
    trapFocus = true,
    closeOnEscape = true,
  } = options

  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  function getFocusableElements() {
    const container = modalRef?.value
    if (!container) return []
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
  }

  function handleKeydown(e) {
    // ── Escape → close ──
    if (e.key === 'Escape' && closeOnEscape) {
      e.preventDefault()
      e.stopPropagation()
      onClose?.()
      return
    }

    // ── Enter → confirm (skip if user is in textarea, select, or contenteditable) ──
    if (e.key === 'Enter' && onConfirm) {
      const tag = e.target?.tagName?.toLowerCase()
      const isEditable = e.target?.isContentEditable
      if (tag !== 'textarea' && tag !== 'select' && !isEditable) {
        // Don't override Enter on buttons — let native click happen
        if (tag !== 'button') {
          e.preventDefault()
          onConfirm()
        }
      }
    }

    // ── Tab → focus trapping ──
    if (e.key === 'Tab' && trapFocus) {
      const focusable = getFocusableElements()
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        // Shift+Tab: if on first element, jump to last
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        // Tab: if on last element, jump to first
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown, true)

    // Auto-focus first focusable element in the modal
    nextTick(() => {
      const focusable = getFocusableElements()
      if (focusable.length > 0) {
        focusable[0].focus()
      }
    })
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown, true)
  })

  return { handleKeydown }
}
