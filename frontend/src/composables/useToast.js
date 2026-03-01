import { ref } from 'vue'

/**
 * Global toast notification composable.
 *
 * Usage:
 *   const { showToast } = useToast()
 *   showToast('Saved successfully', 'success')
 *   showToast('Something went wrong', 'error')
 */

const toasts = ref([])

let _uid = 0

export function useToast() {
  /**
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration - Auto-dismiss in ms (default 3000)
   */
  function showToast(message, type = 'success', duration = 3000) {
    const id = ++_uid
    toasts.value.push({ id, message, type })

    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id)
      }, duration)
    }
  }

  function dismissToast(id) {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  return { toasts, showToast, dismissToast }
}
