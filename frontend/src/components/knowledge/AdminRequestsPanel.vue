<script setup>
import { ref, onMounted, computed } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useLanguage } from '@/composables/useSettings'

const emit = defineEmits(['countChange'])

const { t } = useLanguage()
const knowledgeStore = useKnowledgeStore()

const requests   = ref([])
const loading    = ref(false)
const errorMsg   = ref('')

// Per-item action state: { [id]: 'approving' | 'rejecting' }
const actionStates = ref({})

// Inline confirmation: { id, action, title } or null
const confirmDialog = ref(null)

const pendingCount = computed(() => requests.value.length)

const fetchRequests = async () => {
    loading.value  = true
    errorMsg.value = ''
    confirmDialog.value = null
    try {
        requests.value = await knowledgeStore.fetchPendingRequests()
        emit('countChange', requests.value.length)
    } catch (e) {
        errorMsg.value = e.message || 'Failed to load requests'
        console.error(e)
    } finally {
        loading.value = false
    }
}

onMounted(() => fetchRequests())

const askConfirm = (id, action, title) => {
    confirmDialog.value = { id, action, title }
}

const cancelConfirm = () => {
    confirmDialog.value = null
}

const executeAction = async () => {
    if (!confirmDialog.value) return

    const { id, action } = confirmDialog.value
    actionStates.value[id] = action === 'approve' ? 'approving' : 'rejecting'
    confirmDialog.value = null
    errorMsg.value = ''

    try {
        await knowledgeStore.approvePublish(id, action)
        requests.value = requests.value.filter(r => r._id !== id)
        emit('countChange', requests.value.length)
    } catch (e) {
        errorMsg.value = e.message || `Failed to ${action} request`
    } finally {
        delete actionStates.value[id]
    }
}

const isProcessing   = (id) => !!actionStates.value[id]
const getActionState = (id) => actionStates.value[id] || null

const actionStateLabel = (id) => {
    const state = getActionState(id)
    if (state === 'approving') return t('approving') || 'Approving…'
    if (state === 'rejecting') return t('rejecting') || 'Rejecting…'
    return ''
}
</script>

<template>
  <div class="admin-requests-panel">
    <!-- Header -->
    <div class="panel-header">
      <div class="header-title-area">
        <div>
          <h3>{{ t('managePublishRequests') }}</h3>
          <span v-if="pendingCount > 0" class="header-count">
            {{ pendingCount }} {{ (t('pendingRequests') || 'pending requests').toLowerCase() }}
          </span>
        </div>
      </div>
      <button class="btn-refresh" @click="fetchRequests" :disabled="loading">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ spinning: loading }">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
        {{ t('refreshList') || 'Refresh' }}
      </button>
    </div>

    <!-- Body -->
    <div class="panel-body">
      <!-- Error Banner -->
      <Transition name="fade-down">
        <div v-if="errorMsg" class="error-banner">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{{ errorMsg }}</span>
          <button class="error-dismiss" @click="errorMsg = ''">×</button>
        </div>
      </Transition>

      <!-- Loading -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <span>{{ t('loadingRequests') || 'Loading requests…' }}</span>
      </div>

      <!-- Empty State -->
      <div v-else-if="requests.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <h4>{{ t('noPendingRequests') || 'No pending requests' }}</h4>
        <p>{{ t('noPendingRequestsDesc') || 'All caught up! Nothing to review right now.' }}</p>
      </div>

      <!-- Request Cards -->
      <TransitionGroup v-else name="card-list" tag="div" class="requests-list">
        <div
          v-for="item in requests"
          :key="item._id"
          class="request-card"
          :class="{ processing: isProcessing(item._id) }"
        >
          <div class="card-content">
            <div class="card-left">
              <div class="item-title">{{ item.title }}</div>
              <div class="item-meta">
                <span class="meta-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  {{ item.ownerName || item.ownerId }}
                </span>
                <span class="meta-separator">•</span>
                <span class="meta-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  {{ item.department }}
                </span>
              </div>
            </div>

            <div class="card-center">
              <div class="arrow-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </div>
              <span class="target-badge" :class="`target-${item.requestedType}`">{{ item.requestedType }}</span>
            </div>

            <div class="card-actions">
              <template v-if="getActionState(item._id)">
                <div class="action-processing">
                  <div class="spinner-small"></div>
                  <span>{{ actionStateLabel(item._id) }}</span>
                </div>
              </template>
              <template v-else>
                <button
                  class="btn-approve"
                  @click="askConfirm(item._id, 'approve', item.title)"
                  :aria-label="t('approveRequest') || 'Approve'"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  {{ t('approveRequest') || 'Approve' }}
                </button>
                <button
                  class="btn-reject"
                  @click="askConfirm(item._id, 'reject', item.title)"
                  :aria-label="t('rejectRequest') || 'Reject'"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  {{ t('rejectRequest') || 'Reject' }}
                </button>
              </template>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- Inline Confirmation Bar -->
    <Transition name="confirm-slide">
      <div v-if="confirmDialog" class="confirm-bar">
        <div class="confirm-text">
          <span class="confirm-action-label" :class="confirmDialog.action">
            {{ confirmDialog.action === 'approve' ? '✓ Approve' : '✗ Reject' }}
          </span>
          <span class="confirm-item-title">"{{ confirmDialog.title }}"</span>
          <span class="confirm-question">?</span>
        </div>
        <div class="confirm-actions">
          <button class="btn-confirm-cancel" @click="cancelConfirm">
            {{ t('cancel') || 'Cancel' }}
          </button>
          <button
            class="btn-confirm-action"
            :class="confirmDialog.action"
            @click="executeAction"
          >
            {{ t('confirm') || 'Confirm' }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.admin-requests-panel {
  position: relative;
}

/* ─── Header ─────────────────────────────────────────────────── */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-title-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.header-count {
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 400;
}

/* ─── Refresh Button ─────────────────────────────────────────── */
.btn-refresh {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--color-border);
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s ease;
}
.btn-refresh:hover:not(:disabled) {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: var(--color-text-muted);
}
.btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }

.spinning { animation: spin 1s linear infinite; }

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* ─── Body ───────────────────────────────────────────────────── */
.panel-body {
  min-height: 0;
}

/* ─── Error Banner ───────────────────────────────────────────── */
.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 10px;
  color: #f87171;
  font-size: 13px;
  margin-bottom: 16px;
}
.error-banner span { flex: 1; }

.error-dismiss {
  background: none;
  border: none;
  color: #f87171;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.fade-down-enter-active,
.fade-down-leave-active { transition: all 0.2s ease; }
.fade-down-enter-from   { opacity: 0; transform: translateY(-8px); }
.fade-down-leave-to     { opacity: 0; transform: translateY(-8px); }

/* ─── Loading ────────────────────────────────────────────────── */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 24px;
  color: var(--color-text-muted);
  font-size: 14px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* ─── Empty State ────────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(52, 211, 153, 0.08));
  color: #34d399;
  margin-bottom: 16px;
}

.empty-state h4 {
  margin: 0 0 6px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.empty-state p {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

/* ─── Request Cards ──────────────────────────────────────────── */
.requests-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
}

.request-card {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  transition: all 0.2s ease;
  overflow: hidden;
}
.request-card:hover {
  border-color: var(--color-text-muted);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.request-card.processing {
  opacity: 0.6;
  pointer-events: none;
}

.card-content {
  display: flex;
  align-items: center;
  padding: 14px 18px;
  gap: 12px;
}

.card-left { flex: 1; min-width: 0; }

.item-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-muted);
  flex-wrap: wrap;
}

.meta-item { display: flex; align-items: center; gap: 4px; }
.meta-separator { color: var(--color-border); }

.card-center {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.arrow-icon {
  color: var(--color-text-muted);
  opacity: 0.5;
  display: flex;
}

.target-badge {
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--color-bg-tertiary);
  color: var(--color-text-muted);
}
.target-badge.target-department { background: rgba(59, 130, 246, 0.15);  color: #60a5fa; }
.target-badge.target-public     { background: rgba(16, 185, 129, 0.15); color: #34d399; }

.card-actions { display: flex; gap: 8px; flex-shrink: 0; }

.action-processing {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-muted);
  padding: 0 8px;
}

.btn-approve, .btn-reject {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-approve { background: linear-gradient(135deg, #10b981, #059669); }
.btn-approve:hover {
  background: linear-gradient(135deg, #059669, #047857);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-reject { background: linear-gradient(135deg, #ef4444, #dc2626); }
.btn-reject:hover {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

/* ─── Card List Transition ───────────────────────────────────── */
.card-list-enter-active { transition: all 0.3s ease; }
.card-list-leave-active {
  transition: all 0.3s ease;
  position: absolute;
  width: 100%;
}
.card-list-enter-from { opacity: 0; transform: translateX(-20px); }
.card-list-leave-to   { opacity: 0; transform: translateX(20px);  }
.card-list-move       { transition: transform 0.3s ease; }

/* ─── Confirmation Bar ───────────────────────────────────────── */
.confirm-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  margin-top: 12px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  gap: 12px;
}

.confirm-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}

.confirm-action-label {
  font-weight: 700;
  white-space: nowrap;
}
.confirm-action-label.approve { color: #10b981; }
.confirm-action-label.reject  { color: #ef4444; }

.confirm-item-title {
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.confirm-question { color: var(--color-text-muted); }

.confirm-actions { display: flex; gap: 8px; flex-shrink: 0; }

.btn-confirm-cancel {
  padding: 7px 16px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.btn-confirm-cancel:hover { background: var(--color-bg-hover); }

.btn-confirm-action {
  padding: 7px 16px;
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.btn-confirm-action.approve { background: #10b981; }
.btn-confirm-action.approve:hover { background: #059669; }
.btn-confirm-action.reject  { background: #ef4444; }
.btn-confirm-action.reject:hover  { background: #dc2626; }

/* ─── Confirm Bar Transition ─────────────────────────────────── */
.confirm-slide-enter-active,
.confirm-slide-leave-active { transition: all 0.25s ease; }
.confirm-slide-enter-from,
.confirm-slide-leave-to {
  transform: translateY(10px);
  opacity: 0;
}

/* ─── Responsive ─────────────────────────────────────────────── */
@media (max-width: 640px) {
  .card-content {
    flex-wrap: wrap;
    gap: 10px;
  }

  .card-center {
    order: 3;
    width: 100%;
  }

  .card-actions {
    order: 4;
    width: 100%;
  }

  .btn-approve, .btn-reject {
    flex: 1;
    justify-content: center;
  }

  .confirm-bar {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }

  .confirm-text {
    justify-content: center;
    text-align: center;
  }

  .confirm-item-title { max-width: 100%; }

  .confirm-actions { justify-content: center; }

  .btn-confirm-cancel,
  .btn-confirm-action { flex: 1; text-align: center; }
}
</style>
