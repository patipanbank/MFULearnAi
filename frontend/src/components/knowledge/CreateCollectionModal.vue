<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useAuthStore } from '@/stores/auth'
import { useModalKeyboard } from '@/composables/useModalKeyboard'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useLanguage } from '@/composables/useSettings'

const { confirm: showConfirm } = useConfirmDialog()
const { t } = useLanguage()

const props = defineProps({
    collection: { type: Object, default: null }
})

const emit = defineEmits(['close', 'success'])
const knowledgeStore = useKnowledgeStore()
const authStore = useAuthStore()

const name = ref('')
const description = ref('')
const type = ref('personal')
const loading = ref(false)
const deleting = ref(false)
const error = ref(null)
const touched = ref(false)

const nameInputRef = ref(null)
const isAdmin = authStore.role === 'admin' || authStore.role === 'superadmin'
const isSuperadmin = authStore.role === 'superadmin'
const isEditMode = !!props.collection

const nameError = computed(() => {
    if (!touched.value) return ''
    if (!name.value.trim()) return t('collectionNameRequired')
    if (name.value.trim().length < 2) return t('collectionNameMinLength')
    return ''
})

const descCharCount = computed(() => description.value.length)
const DESC_MAX = 200

onMounted(async () => {
    if (props.collection) {
        name.value = props.collection.name
        description.value = props.collection.description || ''
        type.value = props.collection.type
    }
    await nextTick()
    nameInputRef.value?.focus()
})

const handleSubmit = async () => {
    touched.value = true
    if (!name.value.trim() || name.value.trim().length < 2) return
    
    loading.value = true
    error.value = null
    
    try {
        if (isEditMode) {
            await knowledgeStore.updateCollection(props.collection._id, {
                name: name.value.trim(),
                description: description.value.trim(),
                type: type.value
            })
        } else {
            await knowledgeStore.createCollection({
                name: name.value.trim(),
                description: description.value.trim(),
                type: type.value
            })
        }
        emit('success')
    } catch (e) {
        error.value = e.message
    } finally {
        loading.value = false
    }
}

// ── Keyboard support ──
const modalRef = ref(null)
useModalKeyboard({
  onClose: () => emit('close'),
  onConfirm: () => { if (name.value.trim()) handleSubmit() },
  modalRef,
})

const handleDelete = async () => {
    if (!await showConfirm(t('confirmDeleteCollection'), { variant: 'danger' })) return
    
    deleting.value = true
    error.value = null
    
    try {
        await knowledgeStore.deleteCollection(props.collection._id)
        emit('success')
    } catch (e) {
        error.value = e.message
        deleting.value = false
    }
}
</script>

<template>
  <Transition name="modal-fade" appear>
    <div class="modal-overlay" @click.self="emit('close')">
      <Transition name="modal-slide" appear>
        <div ref="modalRef" class="knowledge-modal">
          <div class="modal-title-row">
            <h2>{{ isEditMode ? t('editCollection') : t('newCollectionTitle') }}</h2>
            <button class="close-btn" @click="emit('close')" :title="t('cancelBtn')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          
          <div class="form-group">
              <label>{{ t('collectionName') }} <span class="required">*</span></label>
              <input
                ref="nameInputRef"
                v-model="name"
                :placeholder="t('collectionNamePlaceholder')"
                :class="{ 'input-error': nameError }"
                @blur="touched = true"
              >
              <Transition name="error-slide">
                <span v-if="nameError" class="field-error">{{ nameError }}</span>
              </Transition>
          </div>
          
          <div class="form-group">
              <label>{{ t('collectionDescLabel') }}</label>
              <textarea
                v-model="description"
                :placeholder="t('collectionDescPlaceholder')"
                rows="3"
                :maxlength="DESC_MAX"
              ></textarea>
              <span class="char-count" :class="{ 'near-limit': descCharCount > DESC_MAX * 0.85 }">
                {{ descCharCount }}/{{ DESC_MAX }}
              </span>
          </div>
          
          <div class="form-group">
              <label>{{ t('colType') }}</label>
              <div class="type-selector">
                <button
                  class="type-option"
                  :class="{ active: type === 'personal' }"
                  @click="type = 'personal'"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  {{ t('filterPersonal') }}
                </button>
                <button
                  v-if="isAdmin"
                  class="type-option"
                  :class="{ active: type === 'department' }"
                  @click="type = 'department'"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="6" x2="12" y2="6.01"/><line x1="12" y1="10" x2="12" y2="10.01"/></svg>
                  {{ t('filterDepartment') }}
                </button>
                <button
                  v-if="isAdmin"
                  class="type-option"
                  :class="{ active: type === 'default' }"
                  @click="type = 'default'"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  {{ t('filterPublic') }}
                </button>
              </div>
          </div>

          <Transition name="error-slide">
            <div v-if="error" class="error">{{ error }}</div>
          </Transition>

          <div class="actions">
              <button v-if="isEditMode" class="btn-delete" @click="handleDelete" :disabled="deleting">
                <svg v-if="deleting" class="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
                {{ deleting ? t('deletingBtn') : t('deleteBtn') }}
              </button>
              <div class="spacer"></div>
              <button class="btn-cancel" @click="emit('close')">{{ t('cancelBtn') }}</button>
              <button class="btn-primary" @click="handleSubmit" :disabled="!name.trim() || loading">
                  <svg v-if="loading" class="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
                  {{ loading ? t('savingBtn') : (isEditMode ? t('updateBtn') : t('createBtn')) }}
              </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
/* Modal transitions */
.modal-fade-enter-active { transition: opacity 0.2s ease; }
.modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

.modal-slide-enter-active { transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-slide-leave-active { transition: all 0.15s ease-in; }
.modal-slide-enter-from { opacity: 0; transform: translateY(16px) scale(0.97); }
.modal-slide-leave-to { opacity: 0; transform: translateY(8px) scale(0.98); }

.error-slide-enter-active { transition: all 0.2s ease; }
.error-slide-leave-active { transition: all 0.15s ease; }
.error-slide-enter-from, .error-slide-leave-to { opacity: 0; transform: translateY(-4px); }

.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.knowledge-modal {
    background-color: var(--color-bg-card, #202020);
    padding: 24px;
    border-radius: 14px;
    width: 440px;
    max-width: 92vw;
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    box-shadow: 0 20px 40px -5px rgba(0, 0, 0, 0.2), 0 10px 20px -5px rgba(0, 0, 0, 0.1);
}

.modal-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

h2 { margin: 0; font-size: 18px; font-weight: 600; }

.close-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.15s;
}
.close-btn:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-border);
    color: var(--color-text-primary);
}

.form-group {
    margin-bottom: 16px;
    position: relative;
}

label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
}

.required { color: #ef4444; }

select, input, textarea {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: 14px;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
}

input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent, #6366f1) 12%, transparent);
}

textarea {
    resize: vertical;
    min-height: 60px;
    max-height: 120px;
    font-family: inherit;
    line-height: 1.5;
}

.input-error {
    border-color: #ef4444 !important;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12) !important;
}

.field-error {
    display: block;
    font-size: 12px;
    color: #ef4444;
    margin-top: 4px;
}

.char-count {
    display: block;
    text-align: right;
    font-size: 11px;
    color: var(--color-text-muted);
    margin-top: 4px;
    transition: color 0.2s;
}
.char-count.near-limit { color: #f59e0b; }

/* Type selector (button group) */
.type-selector {
    display: flex;
    gap: 8px;
}

.type-option {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.type-option:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-accent);
}

.type-option.active {
    background: color-mix(in srgb, var(--color-accent, #6366f1) 10%, transparent);
    border-color: var(--color-accent);
    color: var(--color-accent);
}

.actions {
    display: flex;
    gap: 8px;
    margin-top: 24px;
    align-items: center;
}

.spacer { flex: 1; }

button {
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-weight: 500;
    font-size: 13px;
    transition: all 0.2s;
}

.btn-cancel {
    background: transparent;
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
}
.btn-cancel:hover {
    background: var(--color-bg-hover);
}

.btn-primary {
    background: var(--color-accent);
    color: white;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary:not(:disabled):hover { opacity: 0.9; }

.btn-delete { 
    background: transparent; 
    color: #ef4444; 
    border: 1px solid rgba(239, 68, 68, 0.2);
    padding: 8px 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.btn-delete:hover {
    background: rgba(239, 68, 68, 0.1);
}
.btn-delete:disabled { opacity: 0.5; cursor: not-allowed; }

.error { color: #ef4444; font-size: 13px; margin-bottom: 12px; padding: 8px 12px; background: rgba(239,68,68,0.08); border-radius: 8px; border: 1px solid rgba(239,68,68,0.15); }

/* Spinner animation */
.spinner {
    animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
