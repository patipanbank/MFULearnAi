<script setup>
import { ref } from 'vue'
import { useAdminRequests } from '@/composables/useAdminRequests'
import { useModalKeyboard } from '@/composables/useModalKeyboard'
import RequestCardList from './RequestCardList.vue'

const emit = defineEmits(['close'])

const {
  requests, loading, errorMsg, actionStates, confirmDialog,
  pendingCount, fetchRequests, askConfirm, cancelConfirm,
  executeAction, actionStateLabel, t,
} = useAdminRequests()

// ── Keyboard support ──
const modalRef = ref(null)
useModalKeyboard({
  onClose: () => emit('close'),
  modalRef,
})
</script>

<template>
  <Transition name="modal-fade">
    <div class="modal-overlay" @click="$emit('close')">
      <div ref="modalRef" class="admin-modal" @click.stop role="dialog" aria-modal="true">

        <!-- Header -->
        <div class="modal-header">
          <div class="header-title-area">
            <div class="header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <h3>{{ t('managePublishRequests') }}</h3>
              <span v-if="pendingCount > 0" class="header-count">
                {{ pendingCount }} {{ (t('pendingRequests') || 'pending requests').toLowerCase() }}
              </span>
            </div>
          </div>
          <button class="close-btn" @click="$emit('close')" :aria-label="t('cancel') || 'Close'">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- Toolbar -->
        <div class="modal-toolbar">
          <button class="btn-refresh" @click="fetchRequests" :disabled="loading">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                 stroke-linejoin="round" :class="{ spinning: loading }">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {{ t('refreshList') || 'Refresh' }}
          </button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <RequestCardList
            :requests="requests"
            :loading="loading"
            :error-msg="errorMsg"
            :confirm-dialog="confirmDialog"
            :action-states="actionStates"
            :action-state-label="actionStateLabel"
            @dismiss-error="errorMsg = ''"
            @ask-confirm="askConfirm"
            @cancel-confirm="cancelConfirm"
            @execute-action="executeAction"
          >
            <template #loading-text>{{ t('loadingRequests') || 'Loading requests…' }}</template>
            <template #empty>
              <h4>{{ t('noPendingRequests') || 'No pending requests' }}</h4>
              <p>{{ t('noPendingRequestsDesc') || 'All caught up! Nothing to review right now.' }}</p>
            </template>
            <template #approve-label>{{ t('approveRequest') || 'Approve' }}</template>
            <template #reject-label>{{ t('rejectRequest') || 'Reject' }}</template>
            <template #cancel-label>{{ t('cancel') || 'Cancel' }}</template>
            <template #confirm-label>{{ t('confirm') || 'Confirm' }}</template>
          </RequestCardList>
        </div>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ─── Modal Transition ───────────────────────────────────────── */
.modal-fade-enter-active,
.modal-fade-leave-active { transition: opacity 0.25s ease; }
.modal-fade-enter-active .admin-modal,
.modal-fade-leave-active .admin-modal { transition: transform 0.25s ease, opacity 0.25s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .admin-modal { transform: translateY(16px) scale(0.97); opacity: 0; }
.modal-fade-leave-to   .admin-modal { transform: translateY(8px)  scale(0.98); opacity: 0; }

/* ─── Overlay ────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex; justify-content: center; align-items: center;
  z-index: 1000;
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
}

/* ─── Modal Container ────────────────────────────────────────── */
.admin-modal {
  background: var(--color-bg-card); border-radius: 16px;
  width: 640px; max-width: 92%; max-height: 80vh; max-height: 80svh;
  display: flex; flex-direction: column;
  border: 1px solid var(--color-border); color: var(--color-text-primary);
  box-shadow: 0 24px 48px -12px rgba(0,0,0,.18), 0 0 0 1px rgba(255,255,255,.05) inset;
  overflow: hidden; position: relative;
}

/* ─── Header ─────────────────────────────────────────────────── */
.modal-header {
  padding: 20px 24px; border-bottom: 1px solid var(--color-border);
  display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
}
.header-title-area { display: flex; align-items: center; gap: 12px; }
.header-icon {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, rgba(99,102,241,.15), rgba(168,85,247,.15));
  color: #818cf8; flex-shrink: 0;
}
.modal-header h3 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
.header-count { font-size: 12px; color: var(--color-text-muted); font-weight: 400; }

.close-btn {
  background: none; border: none; padding: 8px; cursor: pointer;
  color: var(--color-text-muted); border-radius: 8px; transition: all 0.15s ease;
  display: flex; align-items: center; justify-content: center;
}
.close-btn:hover { color: var(--color-text-primary); background: var(--color-bg-hover); }

/* ─── Toolbar ────────────────────────────────────────────────── */
.modal-toolbar {
  padding: 12px 24px; border-bottom: 1px solid var(--color-border);
  display: flex; justify-content: flex-end;
  background: var(--color-bg-tertiary); flex-shrink: 0;
}
.btn-refresh {
  display: flex; align-items: center; gap: 6px;
  background: transparent; border: 1px solid var(--color-border);
  padding: 6px 14px; border-radius: 8px; cursor: pointer;
  color: var(--color-text-muted); font-size: 12px; font-weight: 500;
  transition: all 0.15s ease;
}
.btn-refresh:hover:not(:disabled) {
  background: var(--color-bg-hover); color: var(--color-text-primary);
  border-color: var(--color-text-muted);
}
.btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* ─── Body ───────────────────────────────────────────────────── */
.modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
</style>