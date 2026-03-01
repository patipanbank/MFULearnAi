import { ref, computed, onMounted } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useLanguage } from '@/composables/useSettings'

/**
 * Shared logic for admin publish-request review (panel & modal variants).
 *
 * @param {Object} [options]
 * @param {Function} [options.onCountChange] – called with the new pending count after fetch / action
 */
export function useAdminRequests(options = {}) {
  const { t } = useLanguage()
  const knowledgeStore = useKnowledgeStore()

  const requests    = ref([])
  const loading     = ref(false)
  const errorMsg    = ref('')
  const actionStates = ref({})          // { [id]: 'approving' | 'rejecting' }
  const confirmDialog = ref(null)       // { id, action, title } | null

  const pendingCount = computed(() => requests.value.length)

  /* ── Fetch ─────────────────────────────────── */
  const fetchRequests = async () => {
    loading.value  = true
    errorMsg.value = ''
    confirmDialog.value = null
    try {
      requests.value = await knowledgeStore.fetchPendingRequests()
      options.onCountChange?.(requests.value.length)
    } catch (e) {
      errorMsg.value = e.message || 'Failed to load requests'
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  onMounted(fetchRequests)

  /* ── Confirm / Execute ─────────────────────── */
  const askConfirm   = (id, action, title) => { confirmDialog.value = { id, action, title } }
  const cancelConfirm = () => { confirmDialog.value = null }

  const executeAction = async () => {
    if (!confirmDialog.value) return

    const { id, action } = confirmDialog.value
    actionStates.value[id] = action === 'approve' ? 'approving' : 'rejecting'
    confirmDialog.value = null
    errorMsg.value = ''

    try {
      await knowledgeStore.approvePublish(id, action)
      requests.value = requests.value.filter(r => r._id !== id)
      options.onCountChange?.(requests.value.length)
    } catch (e) {
      errorMsg.value = e.message || `Failed to ${action} request`
    } finally {
      delete actionStates.value[id]
    }
  }

  /* ── Helpers ───────────────────────────────── */
  const isProcessing   = (id) => !!actionStates.value[id]
  const getActionState = (id) => actionStates.value[id] || null

  const actionStateLabel = (id) => {
    const state = getActionState(id)
    if (state === 'approving') return t('approving') || 'Approving…'
    if (state === 'rejecting') return t('rejecting') || 'Rejecting…'
    return ''
  }

  return {
    // state
    requests,
    loading,
    errorMsg,
    actionStates,
    confirmDialog,
    pendingCount,
    // actions
    fetchRequests,
    askConfirm,
    cancelConfirm,
    executeAction,
    // helpers
    isProcessing,
    getActionState,
    actionStateLabel,
    t,
  }
}
