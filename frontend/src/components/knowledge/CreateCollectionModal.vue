<script setup>
import { ref, onMounted } from 'vue'
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
const error = ref(null)

const isAdmin = authStore.role === 'admin' || authStore.role === 'superadmin'
const isEditMode = !!props.collection

onMounted(() => {
    if (props.collection) {
        name.value = props.collection.name
        description.value = props.collection.description
        type.value = props.collection.type
    }
})

const handleSubmit = async () => {
    if (!name.value) return
    
    loading.value = true
    error.value = null
    
    try {
        if (isEditMode) {
            await knowledgeStore.updateCollection(props.collection._id, {
                name: name.value,
                description: description.value,
                type: type.value
            })
        } else {
            await knowledgeStore.createCollection({
                name: name.value,
                description: description.value,
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
  onConfirm: () => { if (name.value) handleSubmit() },
  modalRef,
})

const handleDelete = async () => {
    if (!await showConfirm(t('confirmDeleteCollection'), { variant: 'danger' })) return
    
    loading.value = true
    error.value = null
    
    try {
        await knowledgeStore.deleteCollection(props.collection._id)
        emit('success')
    } catch (e) {
        error.value = e.message
        loading.value = false
    }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div ref="modalRef" class="knowledge-modal">
       <h2>{{ isEditMode ? t('editCollection') : t('newCollectionTitle') }}</h2>
       
       <div class="form-group">
          <label>{{ t('collectionName') }}</label>
          <input v-model="name" :placeholder="t('collectionNamePlaceholder')">
       </div>
       
       <div class="form-group">
          <label>{{ t('collectionDescLabel') }}</label>
          <input v-model="description" :placeholder="t('collectionDescPlaceholder')">
       </div>
       
       <div class="form-group">
          <label>{{ t('colType') }}</label>
          <select v-model="type">
              <option value="personal">{{ t('filterPersonal') }}</option>
              <option v-if="isAdmin" value="department">{{ t('filterDepartment') }}</option>
          </select>
       </div>

       <div v-if="error" class="error">{{ error }}</div>

       <div class="actions">
           <button v-if="isEditMode" class="btn-delete" @click="handleDelete" :disabled="loading">{{ t('deleteBtn') }}</button>
           <div class="spacer"></div>
           <button class="btn-cancel" @click="emit('close')">{{ t('cancelBtn') }}</button>
           <button class="btn-primary" @click="handleSubmit" :disabled="!name || loading">
               {{ loading ? t('savingBtn') : (isEditMode ? t('updateBtn') : t('createBtn')) }}
           </button>
       </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.knowledge-modal {
    background-color: var(--color-bg-card, #202020);
    padding: 24px;
    border-radius: 12px;
    width: 400px;
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

h2 { margin-top: 0; font-size: 18px; }

.form-group {
    margin-bottom: 16px;
}

label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
}

select, input {
    width: 100%;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
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
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-weight: 500;
}

.btn-cancel { background: transparent; color: var(--color-text-secondary); }
.btn-primary { background: var(--color-accent); color: white; }
.btn-primary:disabled { opacity: 0.5; }

.btn-delete { 
    background: transparent; 
    color: #ef4444; 
    border: 1px solid rgba(239, 68, 68, 0.2);
    padding: 8px 12px;
}
.btn-delete:hover {
    background: rgba(239, 68, 68, 0.1);
}

.error { color: #ef4444; font-size: 13px; margin-bottom: 12px; }
</style>
