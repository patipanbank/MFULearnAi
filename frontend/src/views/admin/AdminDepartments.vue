<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-left">
        <h1>{{ t('deptPageTitle') }}</h1>
        <p class="subtitle">{{ t('deptPageSubtitle') }}</p>
      </div>
      <button
        v-if="isSuperAdmin"
        id="btn-create-department"
        class="btn-primary"
        @click="openCreateModal"
        :aria-label="t('deptCreate')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {{ t('deptCreate') }}
      </button>
    </div>

    <!-- Error Banner -->
    <div v-if="fetchError" class="error-banner" role="alert">
      <span>{{ fetchError }}</span>
      <button class="btn-retry" @click="fetchDepartments">{{ t('retry') }}</button>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table class="data-table" role="table" :aria-label="t('deptPageTitle')">
        <thead>
          <tr>
            <th scope="col">{{ t('deptName') }}</th>
            <th scope="col">{{ t('deptCreatedAt') }}</th>
            <th v-if="isSuperAdmin" scope="col">{{ t('deptActions') }}</th>
          </tr>
        </thead>
        <tbody>
          <!-- Loading skeleton -->
          <template v-if="loading && departments.length === 0">
            <tr v-for="i in 3" :key="'skeleton-' + i" class="skeleton-row">
              <td><div class="skeleton-text" /></td>
              <td><div class="skeleton-text skeleton-short" /></td>
              <td v-if="isSuperAdmin"><div class="skeleton-text skeleton-icon" /></td>
            </tr>
          </template>

          <!-- Empty state -->
          <tr v-else-if="departments.length === 0">
            <td :colspan="isSuperAdmin ? 3 : 2" class="empty-row">
              <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                  aria-hidden="true">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <p>{{ t('deptEmpty') }}</p>
              </div>
            </td>
          </tr>

          <!-- Data rows -->
          <tr
            v-for="dept in departments"
            :key="dept._id"
            class="clickable-row"
            @click="openEditModal(dept)"
            tabindex="0"
            role="button"
            :aria-label="t('deptEditAria') + dept.name"
            @keydown.enter="openEditModal(dept)"
          >
            <td class="font-medium">{{ dept.name }}</td>
            <td class="text-date">{{ formatDate(dept.createdAt) }}</td>
            <td v-if="isSuperAdmin" class="actions-cell" @click.stop>
              <button
                class="btn-icon delete"
                @click="requestDelete(dept)"
                :title="t('deptDelete')"
                :aria-label="t('deptDeleteAria') + dept.name"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                  aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showModal"
          class="modal-overlay"
          @click.self="closeModal"
          @keydown.escape="closeModal"
          role="dialog"
          :aria-label="isEditing ? t('deptEdit') : t('deptCreate')"
          aria-modal="true"
        >
          <div class="dept-modal" ref="modalContentRef">
            <h2>{{ isEditing ? t('deptEdit') : t('deptCreate') }}</h2>

            <div class="form-group">
              <label for="dept-name-input">{{ t('deptNameLabel') }}</label>
              <input
                id="dept-name-input"
                v-model="form.name"
                type="text"
                :placeholder="t('deptNamePlaceholder')"
                ref="nameInput"
                :disabled="!isSuperAdmin"
                maxlength="100"
                @keydown.enter.prevent="handleSubmit"
                autocomplete="off"
              >
              <p v-if="form.name.length > 80" class="hint warning">
                {{ form.name.length }}/100
              </p>
            </div>

            <div v-if="formError" class="error" role="alert">{{ formError }}</div>

            <div class="actions">
              <button
                v-if="isEditing && isSuperAdmin"
                class="btn-delete"
                @click="requestDelete({ _id: form._id, name: form.name })"
              >
                {{ t('deptDelete') }}
              </button>
              <div class="spacer" />
              <button class="btn-cancel" @click="closeModal">
                {{ isSuperAdmin ? t('cancel') : t('deptClose') }}
              </button>
              <button
                v-if="isSuperAdmin"
                class="btn-primary"
                @click="handleSubmit"
                :disabled="submitting || !form.name.trim()"
              >
                {{ submitting ? t('deptSaving') : t('deptSave') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showDeleteConfirm"
          class="modal-overlay"
          @click.self="cancelDelete"
          @keydown.escape="cancelDelete"
          role="alertdialog"
          :aria-label="t('deptDeleteConfirmTitle')"
          aria-modal="true"
        >
          <div class="dept-modal dept-modal--confirm">
            <h2>{{ t('deptDeleteConfirmTitle') }}</h2>
            <p class="confirm-message">
              {{ t('deptDeleteConfirmMessage').replace('{name}', deleteTarget?.name || '') }}
            </p>
            <div class="actions">
              <div class="spacer" />
              <button class="btn-cancel" @click="cancelDelete" ref="cancelDeleteBtn">
                {{ t('cancel') }}
              </button>
              <button class="btn-danger" @click="confirmDelete" :disabled="deleting">
                {{ deleting ? t('deptDeleting') : t('deptDeleteConfirm') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed, onBeforeUnmount } from 'vue'
import api from '../../utils/api'
import { useAuthStore } from '../../stores/auth'
import { useLanguage } from '../../composables/useSettings'

// ─── Dependencies ───────────────────────────────────────────────
const authStore = useAuthStore()
const { t } = useLanguage()

// ─── Computed ───────────────────────────────────────────────────
const isSuperAdmin = computed(() => authStore.role === 'superadmin')

// ─── State ──────────────────────────────────────────────────────
const departments = ref([])
const loading = ref(false)
const showModal = ref(false)
const submitting = ref(false)
const isEditing = ref(false)
const formError = ref(null)
const fetchError = ref(null)
const nameInput = ref(null)
const modalContentRef = ref(null)

// Delete confirmation state
const showDeleteConfirm = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)
const cancelDeleteBtn = ref(null)

const form = ref({
  _id: null,
  name: '',
  code: ''
})

// ─── Date Formatting ────────────────────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// ─── API Operations ─────────────────────────────────────────────
const fetchDepartments = async () => {
  loading.value = true
  fetchError.value = null
  try {
    const response = await api.get('/departments')
    departments.value = response.data.departments || []
  } catch (err) {
    console.error('Failed to fetch departments:', err)
    fetchError.value = t('deptFetchError')
  } finally {
    loading.value = false
  }
}

const handleSubmit = async () => {
  const trimmedName = form.value.name.trim()
  if (!trimmedName) return

  // Client-side validation
  if (trimmedName.length < 2) {
    formError.value = t('deptNameTooShort')
    return
  }
  if (trimmedName.length > 100) {
    formError.value = t('deptNameTooLong')
    return
  }

  submitting.value = true
  formError.value = null

  try {
    if (isEditing.value) {
      await api.put(`/departments/${form.value._id}`, { name: trimmedName })
    } else {
      await api.post('/departments', { name: trimmedName, code: null })
    }
    await fetchDepartments()
    closeModal()
  } catch (err) {
    formError.value = err.response?.data?.error || err.message || t('deptOperationFailed')
  } finally {
    submitting.value = false
  }
}

// ─── Delete Flow (Styled Confirmation) ─────────────────────────
const requestDelete = (dept) => {
  deleteTarget.value = dept
  showDeleteConfirm.value = true
  nextTick(() => cancelDeleteBtn.value?.focus())
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
  deleteTarget.value = null
}

const confirmDelete = async () => {
  if (!deleteTarget.value?._id) return

  deleting.value = true
  try {
    await api.delete(`/departments/${deleteTarget.value._id}`)
    departments.value = departments.value.filter(d => d._id !== deleteTarget.value._id)
    showDeleteConfirm.value = false
    deleteTarget.value = null
    closeModal()
  } catch (err) {
    // Show error in the delete confirm dialog
    formError.value = err.response?.data?.error || t('deptDeleteFailed')
  } finally {
    deleting.value = false
  }
}

// ─── Modal Lifecycle ────────────────────────────────────────────
const openCreateModal = () => {
  isEditing.value = false
  form.value = { _id: null, name: '', code: '' }
  formError.value = null
  showModal.value = true
  nextTick(() => nameInput.value?.focus())
}

const openEditModal = (dept) => {
  isEditing.value = true
  form.value = { ...dept }
  formError.value = null
  showModal.value = true
  nextTick(() => nameInput.value?.focus())
}

const closeModal = () => {
  showModal.value = false
}

// ─── Keyboard: Global Escape ────────────────────────────────────
const handleGlobalKeydown = (e) => {
  if (e.key === 'Escape') {
    if (showDeleteConfirm.value) {
      cancelDelete()
    } else if (showModal.value) {
      closeModal()
    }
  }
}

// ─── Lifecycle ──────────────────────────────────────────────────
onMounted(() => {
  fetchDepartments()
  document.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style scoped>
/* ─── Page Layout ──────────────────────────────────────────────── */
.page-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
  background: var(--color-bg-primary, #121212);
  color: var(--color-text-primary, #ffffff);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px 0;
}

.subtitle {
  color: var(--color-text-muted, #9ca3af);
  font-size: 14px;
}

/* ─── Buttons ──────────────────────────────────────────────────── */
.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--color-accent, #3b82f6);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-cancel {
  background: transparent;
  color: var(--color-text-secondary, #d1d5db);
  border: 1px solid var(--color-border, #374151);
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.btn-cancel:hover { background: var(--color-bg-tertiary, #2a2a2a); }

.btn-delete {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.btn-delete:hover { background: rgba(239, 68, 68, 0.2); }

.btn-danger {
  background: #ef4444;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: opacity 0.15s ease;
}
.btn-danger:hover { opacity: 0.9; }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-retry {
  background: transparent;
  color: var(--color-accent, #3b82f6);
  border: 1px solid var(--color-accent, #3b82f6);
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-icon.delete {
  background: transparent;
  border: 1px solid transparent;
  color: var(--color-text-muted, #9ca3af);
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.15s ease;
}
.btn-icon.delete:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
}

/* ─── Error Banner ─────────────────────────────────────────────── */
.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #ef4444;
  font-size: 14px;
}

/* ─── Table ────────────────────────────────────────────────────── */
.table-container {
  background: var(--color-bg-secondary, #1e1e1e);
  border: 1px solid var(--color-border, #374151);
  border-radius: 12px;
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th,
.data-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid var(--color-border, #374151);
}

.data-table th {
  color: var(--color-text-muted, #9ca3af);
  font-weight: 500;
  font-size: 13px;
  background: var(--color-bg-tertiary, #252525);
  text-transform: uppercase;
}

.clickable-row {
  cursor: pointer;
  transition: background 0.15s ease;
}
.clickable-row:hover {
  background: var(--color-bg-tertiary, #2a2a2a);
}
.clickable-row:focus-visible {
  outline: 2px solid var(--color-accent, #3b82f6);
  outline-offset: -2px;
}

.font-medium { font-weight: 500; }

.text-date {
  color: var(--color-text-secondary, #d1d5db);
  font-size: 13px;
}

.actions-cell {
  width: 60px;
}

/* ─── Empty State ──────────────────────────────────────────────── */
.empty-row {
  text-align: center;
  color: var(--color-text-muted);
  padding: 32px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 0;
  color: var(--color-text-muted, #9ca3af);
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

/* ─── Loading Skeleton ─────────────────────────────────────────── */
.skeleton-row td {
  padding: 16px;
}

.skeleton-text {
  height: 16px;
  width: 60%;
  background: linear-gradient(
    90deg,
    var(--color-bg-tertiary, #2a2a2a) 25%,
    var(--color-bg-secondary, #333) 50%,
    var(--color-bg-tertiary, #2a2a2a) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-short { width: 35%; }
.skeleton-icon { width: 28px; height: 28px; border-radius: 6px; }

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ─── Modal ────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  backdrop-filter: blur(2px);
}

.dept-modal {
  background-color: var(--color-bg-card, #202020);
  padding: 24px;
  border-radius: 12px;
  width: 420px;
  max-width: calc(100vw - 32px);
  border: 1px solid var(--color-border, #374151);
  color: var(--color-text-primary, white);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
}

.dept-modal--confirm {
  width: 380px;
}

.dept-modal h2 {
  margin-top: 0;
  font-size: 18px;
  margin-bottom: 20px;
}

.confirm-message {
  font-size: 14px;
  color: var(--color-text-secondary, #d1d5db);
  line-height: 1.5;
  margin: 0 0 8px 0;
}

/* ─── Form ─────────────────────────────────────────────────────── */
.form-group { margin-bottom: 16px; }

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary, #e5e7eb);
}

.form-group input {
  width: 100%;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border, #4b5563);
  background: var(--color-bg-tertiary, #2a2a2a);
  color: var(--color-text-primary, white);
  font-size: 14px;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}
.form-group input:focus {
  outline: none;
  border-color: var(--color-accent, #3b82f6);
}
.form-group input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint {
  font-size: 12px;
  color: var(--color-text-muted, #9ca3af);
  margin-top: 4px;
}
.hint.warning {
  color: #f59e0b;
}

.error {
  color: #ef4444;
  font-size: 13px;
  margin-bottom: 16px;
  background: rgba(239, 68, 68, 0.1);
  padding: 8px 12px;
  border-radius: 6px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
}

.spacer { flex: 1; }

/* ─── Modal Transitions ───────────────────────────────────────── */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active .dept-modal,
.modal-leave-active .dept-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .dept-modal {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}
.modal-leave-to .dept-modal {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}
</style>
