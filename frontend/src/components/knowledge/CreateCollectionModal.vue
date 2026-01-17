<script setup>
import { ref } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits(['close', 'success'])
const knowledgeStore = useKnowledgeStore()
const authStore = useAuthStore()

const name = ref('')
const description = ref('')
const type = ref('personal')
const loading = ref(false)
const error = ref(null)

const isAdmin = authStore.role === 'admin'

const handleCreate = async () => {
    if (!name.value) return
    
    loading.value = true
    error.value = null
    
    try {
        await knowledgeStore.createCollection({
            name: name.value,
            description: description.value,
            type: type.value
        })
        emit('success')
    } catch (e) {
        error.value = e.message
    } finally {
        loading.value = false
    }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
       <h2>New Collection</h2>
       
       <div class="form-group">
          <label>Name</label>
          <input v-model="name" placeholder="Collection Name">
       </div>
       
       <div class="form-group">
          <label>Description (Optional)</label>
          <input v-model="description" placeholder="What is this collection for?">
       </div>
       
       <div class="form-group">
          <label>Type</label>
          <select v-model="type">
              <option value="personal">Personal</option>
              <option v-if="isAdmin" value="department">Department</option>
              <!-- Admins cannot create 'default' via UI easily without strict intent, leaving strictly department for now -->
          </select>
       </div>

       <div v-if="error" class="error">{{ error }}</div>

       <div class="actions">
           <button class="btn-cancel" @click="emit('close')">Cancel</button>
           <button class="btn-primary" @click="handleCreate" :disabled="!name || loading">
               {{ loading ? 'Creating...' : 'Create' }}
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

.modal {
    background: var(--color-bg-card);
    padding: 24px;
    border-radius: 12px;
    width: 400px;
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
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
    justify-content: flex-end;
    gap: 8px;
    margin-top: 24px;
}

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

.error { color: #ef4444; font-size: 13px; margin-bottom: 12px; }
</style>
