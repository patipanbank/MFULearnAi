<script setup>
import { useAdminRequests } from '@/composables/useAdminRequests'
import RequestCardList from './RequestCardList.vue'

const emit = defineEmits(['countChange'])

const {
  requests, loading, errorMsg, actionStates, confirmDialog,
  pendingCount, fetchRequests, askConfirm, cancelConfirm,
  executeAction, actionStateLabel, t,
} = useAdminRequests({
  onCountChange: (count) => emit('countChange', count),
})
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
</template>

<style scoped>
.admin-requests-panel { position: relative; }

.panel-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
}
.header-title-area { display: flex; align-items: center; gap: 12px; }
.panel-header h3 {
  margin: 0; font-size: 17px; font-weight: 600;
  color: var(--color-text-primary); letter-spacing: -0.01em;
}
.header-count { font-size: 12px; color: var(--color-text-muted); font-weight: 400; }

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
</style>
