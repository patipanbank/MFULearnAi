import { reactive, readonly } from 'vue'

/**
 * Global confirmation / alert dialog state.
 *
 * Usage:
 *   const { confirm, alert } = useConfirmDialog()
 *
 *   // confirm() returns a Promise<boolean>
 *   if (await confirm('Delete this?')) { ... }
 *
 *   // alert() returns a Promise<void> (just shows a message, one button)
 *   await alert('Something went wrong')
 */

const state = reactive({
  visible: false,
  title: '',
  message: '',
  type: 'confirm', // 'confirm' | 'alert' | 'success' | 'error' | 'warning'
  confirmLabel: '',
  cancelLabel: '',
  variant: 'danger', // 'danger' | 'warning' | 'info' | 'success'
  resolve: null,
})

function _open(options) {
  return new Promise((resolve) => {
    state.title = options.title || ''
    state.message = options.message || ''
    state.type = options.type || 'confirm'
    state.confirmLabel = options.confirmLabel || ''
    state.cancelLabel = options.cancelLabel || ''
    state.variant = options.variant || 'danger'
    state.resolve = resolve
    state.visible = true
  })
}

function _close(result) {
  state.visible = false
  state.resolve?.(result)
  state.resolve = null
}

export function useConfirmDialog() {
  /**
   * Show a confirm dialog. Returns true if confirmed, false if cancelled.
   * @param {string} message
   * @param {Object} [opts]
   * @param {string} [opts.title]
   * @param {string} [opts.confirmLabel]
   * @param {string} [opts.cancelLabel]
   * @param {'danger'|'warning'|'info'|'success'} [opts.variant]
   * @returns {Promise<boolean>}
   */
  const confirm = (message, opts = {}) =>
    _open({ ...opts, message, type: 'confirm' })

  /**
   * Show an alert dialog. Returns when the user dismisses it.
   * @param {string} message
   * @param {Object} [opts]
   * @param {string} [opts.title]
   * @param {'danger'|'warning'|'info'|'success'|'error'} [opts.variant]
   * @returns {Promise<void>}
   */
  const alert = (message, opts = {}) =>
    _open({ ...opts, message, type: 'alert', variant: opts.variant || 'info' })

  return {
    /** Reactive (read-only) state for the GlobalConfirmDialog component */
    dialogState: readonly(state),
    confirm,
    alert,
    /** Close the dialog (used by the component) */
    closeDialog: _close,
  }
}
