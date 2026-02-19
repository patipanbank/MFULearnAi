<script setup>
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useLanguage } from '@/composables/useSettings'

const props = defineProps({
  item: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'success'])

const authStore = useAuthStore()
const knowledgeStore = useKnowledgeStore()
const { t } = useLanguage()

const isOwner = computed(() => props.item.ownerId === authStore.userId)

// Inline confirm for publish request
const showPublishConfirm = ref(false)
const publishing = ref(false)

const askPublishConfirm = () => {
    showPublishConfirm.value = true
}

const cancelPublish = () => {
    showPublishConfirm.value = false
}

const handleRequestPublish = async () => {
    publishing.value = true
    showPublishConfirm.value = false

    try {
        await knowledgeStore.requestPublish(props.item._id, 'department')
        emit('success')
        emit('close')
    } catch (e) {
        // Show inline error instead of alert()
        publishError.value = e.message || 'Failed to request publish'
    } finally {
        publishing.value = false
    }
}

const publishError = ref('')

const formatDate = (dateString) => {
    if (!dateString) return '-'
    const d = new Date(dateString)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const showReadMode = ref(false)
const toggleReadMode = () => showReadMode.value = !showReadMode.value

// Status color mapping
const getStatusColor = (status) => {
    switch (status) {
        case 'pending': return '#f59e0b'
        case 'approved': return '#10b981'
        case 'rejected': return '#ef4444'
        default: return 'var(--color-text-muted)'
    }
}
</script>

<template>
  <Transition name="modal-fade">
    <div class="modal-overlay" @click="$emit('close')">
      <div class="knowledge-modal" @click.stop role="dialog" aria-modal="true">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-title-area">
            <div class="header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </div>
            <h3>{{ t('knowledgeDetails') }}</h3>
          </div>
          <button class="close-btn" @click="$emit('close')" :aria-label="t('cancel')">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <!-- Title -->
          <div class="detail-group">
            <label>{{ t('knowledgeDetailTitle') }}</label>
            <div class="value title">{{ item.title }}</div>
          </div>

          <!-- Type + Department -->
          <div class="detail-row">
            <div class="detail-group">
              <label>{{ t('knowledgeDetailType') }}</label>
              <div class="value">
                <span class="badge" :class="item.type">{{ item.type }}</span>
              </div>
            </div>
            <div class="detail-group">
              <label>{{ t('knowledgeDetailDept') }}</label>
              <div class="value">{{ item.department }}</div>
            </div>
          </div>

          <!-- Description -->
          <div class="detail-group">
            <label>{{ t('knowledgeDetailDesc') }}</label>
            <div class="value desc">{{ item.description || t('knowledgeDetailNoDesc') }}</div>
          </div>

          <!-- Source + Created -->
          <div class="detail-row">
            <div class="detail-group">
              <label>{{ t('knowledgeDetailSource') }}</label>
              <div class="value file">{{ item.contentSource }}</div>
            </div>
            <div class="detail-group">
              <label>{{ t('knowledgeDetailCreated') }}</label>
              <div class="value">{{ formatDate(item.createdAt) }}</div>
            </div>
          </div>

          <!-- Content Preview -->
          <div class="detail-group">
            <div class="content-header">
              <label>{{ t('knowledgeDetailContent') }}</label>
              <button v-if="item.content" class="btn-expand" @click="toggleReadMode">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <polyline points="9 21 3 21 3 15"></polyline>
                  <line x1="21" y1="3" x2="14" y2="10"></line>
                  <line x1="3" y1="21" x2="10" y2="14"></line>
                </svg>
                {{ t('knowledgeDetailExpand') }}
              </button>
            </div>

            <div class="content-box">
              <pre v-if="item.content">{{ item.content }}</pre>
              <div v-else class="no-content">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <p>{{ t('knowledgeDetailNoContent') }}</p>
                <small>{{ t('knowledgeDetailNoContentDesc') }}</small>
              </div>
            </div>
          </div>

          <!-- Full Screen Read Modal -->
          <Teleport to="body">
            <Transition name="read-fade">
              <div v-if="showReadMode && item.content" class="read-mode-overlay" @click="toggleReadMode">
                <div class="read-mode-content" @click.stop>
                  <div class="read-header">
                    <h3>{{ item.title }}</h3>
                    <button class="close-btn" @click="toggleReadMode" :aria-label="t('cancel')">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                  <div class="read-body">
                    <pre>{{ item.content }}</pre>
                  </div>
                </div>
              </div>
            </Transition>
          </Teleport>

          <!-- Publish Status Section -->
          <div class="status-section" v-if="item.requestStatus !== 'none'">
            <h4>{{ t('publishStatus') }}</h4>
            <div class="status-box" :class="item.requestStatus">
              <div class="status-indicator">
                <span class="status-dot" :style="{ background: getStatusColor(item.requestStatus) }"></span>
                <span class="status-label">
                  {{ t('publishStatusLabel') }}: <strong>{{ item.requestStatus }}</strong>
                </span>
              </div>
              <span v-if="item.requestedType" class="target-label">
                {{ t('publishTargetLabel') }}: {{ item.requestedType }}
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="actions-section" v-if="isOwner && item.type === 'personal'">
            <h4>{{ t('knowledgeActions') }}</h4>

            <!-- Error banner for publish action -->
            <div v-if="publishError" class="error-inline">
              <span>{{ publishError }}</span>
              <button @click="publishError = ''">×</button>
            </div>

            <div class="btn-group">
              <button
                v-if="item.requestStatus === 'none' || item.requestStatus === 'rejected'"
                class="btn-action"
                :disabled="publishing"
                @click="askPublishConfirm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                  <polyline points="16 6 12 2 8 6"></polyline>
                  <line x1="12" y1="2" x2="12" y2="15"></line>
                </svg>
                {{ publishing ? t('loadingData') : t('requestPublishToDept') }}
              </button>
            </div>

            <!-- Inline Publish Confirm -->
            <Transition name="confirm-fade">
              <div v-if="showPublishConfirm" class="publish-confirm">
                <p>{{ t('confirmPublishToDept') }}</p>
                <div class="confirm-btns">
                  <button class="btn-cancel" @click="cancelPublish">{{ t('cancel') }}</button>
                  <button class="btn-confirm" @click="handleRequestPublish">{{ t('confirm') }}</button>
                </div>
              </div>
            </Transition>

            <p v-if="item.requestStatus === 'pending'" class="pending-msg">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              {{ t('pendingApproval') }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ─── Modal Transition ───────────────────────────────────────── */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}
.modal-fade-enter-active .knowledge-modal,
.modal-fade-leave-active .knowledge-modal {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-from .knowledge-modal {
  transform: translateY(16px) scale(0.97);
  opacity: 0;
}
.modal-fade-leave-to .knowledge-modal {
  transform: translateY(8px) scale(0.98);
  opacity: 0;
}

/* ─── Read Mode Transition ───────────────────────────────────── */
.read-fade-enter-active,
.read-fade-leave-active {
  transition: opacity 0.3s ease;
}
.read-fade-enter-active .read-mode-content,
.read-fade-leave-active .read-mode-content {
  transition: transform 0.3s ease;
}
.read-fade-enter-from { opacity: 0; }
.read-fade-leave-to { opacity: 0; }
.read-fade-enter-from .read-mode-content {
  transform: scale(0.95);
}

/* ─── Confirm Transition ─────────────────────────────────────── */
.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: all 0.2s ease;
}
.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ─── Overlay ────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* ─── Modal Container ────────────────────────────────────────── */
.knowledge-modal {
  background: var(--color-bg-card);
  border-radius: 16px;
  width: 540px;
  max-width: 92%;
  max-height: 85vh;
  max-height: 85svh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  box-shadow:
    0 24px 48px -12px rgba(0, 0, 0, 0.18),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  overflow: hidden;
}

/* ─── Header ─────────────────────────────────────────────────── */
.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(99, 102, 241, 0.12));
  color: #60a5fa;
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.close-btn {
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: var(--color-text-muted);
  border-radius: 8px;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}
.close-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-hover);
}

/* ─── Body ───────────────────────────────────────────────────── */
.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.detail-group {
  margin-bottom: 18px;
}

.detail-row {
  display: flex;
  gap: 24px;
}
.detail-row .detail-group { flex: 1; }

label {
  display: block;
  font-size: 11px;
  color: var(--color-text-muted);
  margin-bottom: 6px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.value {
  font-size: 14px;
  color: var(--color-text-primary);
}

.value.title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.value.desc {
  color: var(--color-text-secondary);
  line-height: 1.6;
  background: var(--color-bg-tertiary);
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
}

.value.file {
  font-family: 'Courier New', monospace;
  background: var(--color-bg-tertiary);
  padding: 4px 10px;
  border-radius: 6px;
  display: inline-block;
  font-size: 13px;
  border: 1px solid var(--color-border);
}

/* ─── Badges ─────────────────────────────────────────────────── */
.badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.badge.personal { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }
.badge.department { background: rgba(16, 185, 129, 0.12); color: #10b981; }
.badge.public { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
.badge.policy { background: rgba(139, 92, 246, 0.12); color: #8b5cf6; }

/* ─── Content Preview ────────────────────────────────────────── */
.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.btn-expand {
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  color: var(--color-accent);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s ease;
}
.btn-expand:hover {
  background: rgba(99, 102, 241, 0.1);
}

.content-box {
  background: var(--color-bg-tertiary);
  border-radius: 10px;
  padding: 14px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
}

.content-box pre {
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.6;
}

.no-content {
  color: var(--color-text-muted);
  font-size: 13px;
  text-align: center;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.no-content p { margin: 0; font-weight: 500; }
.no-content small { font-size: 11px; opacity: 0.7; }

/* ─── Status Section ─────────────────────────────────────────── */
.status-section {
  margin-top: 8px;
  padding-top: 18px;
  border-top: 1px solid var(--color-border);
}

h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--color-bg-tertiary);
  font-size: 14px;
  border: 1px solid var(--color-border);
}

.status-box.pending { border-left: 4px solid #f59e0b; }
.status-box.approved { border-left: 4px solid #10b981; }
.status-box.rejected { border-left: 4px solid #ef4444; }

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

/* ─── Actions Section ────────────────────────────────────────── */
.actions-section {
  margin-top: 8px;
  padding-top: 18px;
  border-top: 1px solid var(--color-border);
}

.error-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 8px;
  color: #f87171;
  font-size: 13px;
  margin-bottom: 12px;
}
.error-inline button {
  background: none;
  border: none;
  color: #f87171;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.btn-group {
  display: flex;
  gap: 8px;
}

.btn-action {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 16px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  color: var(--color-text-primary);
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s ease;
}

.btn-action:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--color-accent), #7c3aed);
  color: white;
  border-color: transparent;
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ─── Publish Confirm ────────────────────────────────────────── */
.publish-confirm {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 14px;
  margin-top: 10px;
}

.publish-confirm p {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.confirm-btns {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 7px 16px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-cancel:hover { background: var(--color-bg-hover); }

.btn-confirm {
  padding: 7px 16px;
  background: var(--color-accent);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-confirm:hover { opacity: 0.9; }

.pending-msg {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #f59e0b;
  font-size: 13px;
  margin-top: 12px;
  padding: 10px;
  background: rgba(245, 158, 11, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(245, 158, 11, 0.2);
  font-weight: 500;
}

/* ─── Read Mode ──────────────────────────────────────────────── */
.read-mode-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  z-index: 2000;
  display: flex;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.read-mode-content {
  background: var(--color-bg-card);
  width: 800px;
  max-width: 95%;
  height: 90vh;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 32px 64px -16px rgba(0, 0, 0, 0.35);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.read-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.read-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.read-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: var(--color-bg-tertiary);
}

.read-body pre {
  white-space: pre-wrap;
  font-family: 'Inter', sans-serif;
  font-size: 15px;
  line-height: 1.7;
  color: var(--color-text-primary);
  max-width: 100%;
  margin: 0;
}

/* ─── Responsive ─────────────────────────────────────────────── */
@media (max-width: 640px) {
  .detail-row {
    flex-direction: column;
    gap: 0;
  }

  .modal-body {
    padding: 16px;
  }

  .value.title {
    font-size: 16px;
  }
}
</style>
