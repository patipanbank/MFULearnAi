<script setup>
/**
 * Shared request-card list used by both AdminRequestsPanel and AdminRequestsModal.
 * Renders error banner, loading, empty state, card list, and inline confirmation bar.
 */
const props = defineProps({
  requests:         { type: Array,    required: true },
  loading:          { type: Boolean,  default: false },
  errorMsg:         { type: String,   default: '' },
  confirmDialog:    { type: Object,   default: null },
  actionStates:     { type: Object,   default: () => ({}) },
  actionStateLabel: { type: Function, default: () => '' },
})

const emit = defineEmits([
  'dismiss-error',
  'ask-confirm',
  'cancel-confirm',
  'execute-action',
])

const isProcessing = (id) => !!props.actionStates[id]
</script>

<template>
  <div class="rcl-root">
    <!-- Error Banner -->
    <Transition name="fade-down">
      <div v-if="errorMsg" class="error-banner">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{{ errorMsg }}</span>
        <button class="error-dismiss" @click="emit('dismiss-error')">×</button>
      </div>
    </Transition>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span><slot name="loading-text">Loading requests…</slot></span>
    </div>

    <!-- Empty State -->
    <div v-else-if="requests.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <slot name="empty">
        <h4>No pending requests</h4>
        <p>All caught up! Nothing to review right now.</p>
      </slot>
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
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                {{ item.ownerName || item.ownerId }}
              </span>
              <span class="meta-separator">•</span>
              <span class="meta-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                {{ item.department }}
              </span>
            </div>
          </div>

          <div class="card-center">
            <div class="arrow-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
            <span class="target-badge" :class="`target-${item.requestedType}`">{{ item.requestedType }}</span>
          </div>

          <div class="card-actions">
            <template v-if="isProcessing(item._id)">
              <div class="action-processing">
                <div class="spinner-small"></div>
                <span>{{ actionStateLabel(item._id) }}</span>
              </div>
            </template>
            <template v-else>
              <button class="btn-approve" @click="emit('ask-confirm', item._id, 'approve', item.title)">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <slot name="approve-label">Approve</slot>
              </button>
              <button class="btn-reject" @click="emit('ask-confirm', item._id, 'reject', item.title)">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <slot name="reject-label">Reject</slot>
              </button>
            </template>
          </div>
        </div>
      </div>
    </TransitionGroup>

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
          <button class="btn-confirm-cancel" @click="emit('cancel-confirm')">
            <slot name="cancel-label">Cancel</slot>
          </button>
          <button
            class="btn-confirm-action"
            :class="confirmDialog.action"
            @click="emit('execute-action')"
          >
            <slot name="confirm-label">Confirm</slot>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
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
  background: none; border: none; color: #f87171;
  font-size: 18px; cursor: pointer; padding: 0 4px; line-height: 1;
}

.fade-down-enter-active, .fade-down-leave-active { transition: all 0.2s ease; }
.fade-down-enter-from { opacity: 0; transform: translateY(-8px); }
.fade-down-leave-to   { opacity: 0; transform: translateY(-8px); }

/* ─── Loading ────────────────────────────────────────────────── */
.loading-state {
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; padding: 48px 24px;
  color: var(--color-text-muted); font-size: 14px;
}
.spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
.spinner-small {
  width: 16px; height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* ─── Empty State ────────────────────────────────────────────── */
.empty-state {
  display: flex; flex-direction: column; align-items: center;
  padding: 48px 24px; text-align: center;
}
.empty-icon {
  width: 72px; height: 72px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(52, 211, 153, 0.08));
  color: #34d399; margin-bottom: 16px;
}
.empty-state h4 { margin: 0 0 6px 0; font-size: 16px; font-weight: 600; color: var(--color-text-primary); }
.empty-state p   { margin: 0; font-size: 13px; color: var(--color-text-muted); }

/* ─── Request Cards ──────────────────────────────────────────── */
.requests-list { display: flex; flex-direction: column; gap: 10px; position: relative; }

.request-card {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 12px; transition: all 0.2s ease; overflow: hidden;
}
.request-card:hover { border-color: var(--color-text-muted); box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.request-card.processing { opacity: 0.6; pointer-events: none; }

.card-content { display: flex; align-items: center; padding: 14px 18px; gap: 12px; }
.card-left { flex: 1; min-width: 0; }

.item-title {
  font-weight: 600; font-size: 14px; margin-bottom: 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.item-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-muted); flex-wrap: wrap; }
.meta-item { display: flex; align-items: center; gap: 4px; }
.meta-separator { color: var(--color-border); }

.card-center { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.arrow-icon { color: var(--color-text-muted); opacity: 0.5; display: flex; }

.target-badge {
  padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.5px;
  background: var(--color-bg-tertiary); color: var(--color-text-muted);
}
.target-badge.target-department { background: rgba(59,130,246,.15); color: #60a5fa; }
.target-badge.target-public     { background: rgba(16,185,129,.15); color: #34d399; }

.card-actions { display: flex; gap: 8px; flex-shrink: 0; }
.action-processing { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--color-text-muted); padding: 0 8px; }

.btn-approve, .btn-reject {
  display: flex; align-items: center; gap: 5px;
  padding: 7px 14px; border: none; border-radius: 8px;
  color: white; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.15s ease; white-space: nowrap;
}
.btn-approve { background: linear-gradient(135deg, #10b981, #059669); }
.btn-approve:hover { background: linear-gradient(135deg, #059669, #047857); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(16,185,129,.3); }
.btn-reject  { background: linear-gradient(135deg, #ef4444, #dc2626); }
.btn-reject:hover  { background: linear-gradient(135deg, #dc2626, #b91c1c); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(239,68,68,.3); }

/* ─── Card List Transition ───────────────────────────────────── */
.card-list-enter-active { transition: all 0.3s ease; }
.card-list-leave-active { transition: all 0.3s ease; position: absolute; width: 100%; }
.card-list-enter-from { opacity: 0; transform: translateX(-20px); }
.card-list-leave-to   { opacity: 0; transform: translateX(20px); }
.card-list-move       { transition: transform 0.3s ease; }

/* ─── Confirmation Bar ───────────────────────────────────────── */
.confirm-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; margin-top: 12px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border); border-radius: 12px; gap: 12px;
}
.confirm-text {
  font-size: 13px; font-weight: 500; color: var(--color-text-primary);
  flex: 1; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0;
}
.confirm-action-label { font-weight: 700; white-space: nowrap; }
.confirm-action-label.approve { color: #10b981; }
.confirm-action-label.reject  { color: #ef4444; }
.confirm-item-title {
  color: var(--color-text-secondary); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; max-width: 200px;
}
.confirm-question { color: var(--color-text-muted); }
.confirm-actions { display: flex; gap: 8px; flex-shrink: 0; }

.btn-confirm-cancel {
  padding: 7px 16px; background: transparent;
  border: 1px solid var(--color-border); border-radius: 8px;
  color: var(--color-text-secondary); font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all 0.15s ease; white-space: nowrap;
}
.btn-confirm-cancel:hover { background: var(--color-bg-hover); }

.btn-confirm-action {
  padding: 7px 16px; border: none; border-radius: 8px;
  color: white; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 0.15s ease; white-space: nowrap;
}
.btn-confirm-action.approve       { background: #10b981; }
.btn-confirm-action.approve:hover { background: #059669; }
.btn-confirm-action.reject        { background: #ef4444; }
.btn-confirm-action.reject:hover  { background: #dc2626; }

.confirm-slide-enter-active, .confirm-slide-leave-active { transition: all 0.25s ease; }
.confirm-slide-enter-from, .confirm-slide-leave-to { transform: translateY(10px); opacity: 0; }

/* ─── Responsive ─────────────────────────────────────────────── */
@media (max-width: 640px) {
  .card-content { flex-wrap: wrap; gap: 10px; }
  .card-center  { order: 3; width: 100%; }
  .card-actions { order: 4; width: 100%; }
  .btn-approve, .btn-reject { flex: 1; justify-content: center; }
  .confirm-bar { flex-direction: column; gap: 10px; align-items: stretch; }
  .confirm-text { justify-content: center; text-align: center; }
  .confirm-item-title { max-width: 100%; }
  .confirm-actions { justify-content: center; }
  .btn-confirm-cancel, .btn-confirm-action { flex: 1; text-align: center; }
}
</style>
