<script setup>
import { ref, computed } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits(['close', 'success'])
const knowledgeStore = useKnowledgeStore()
const authStore = useAuthStore()

// Upload constraints — aligned with nginx client_max_body_size (100M) for knowledge route
const MAX_FILE_SIZE_MB = 50
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const ALLOWED_EXTENSIONS = ['pdf', 'txt']

const file = ref(null)
const type = ref('personal')
const loading = ref(false)
const error = ref(null)

const uploadProgress = ref(0)
const uploadStage = ref('')

// Admin check — visibility options depend on this
const isAdmin = computed(() => {
    const role = authStore.role || authStore.user?.role
    return role === 'admin' || role === 'superadmin'
})

const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (!selected) { file.value = null; return }

    // Validate file extension
    const ext = selected.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        error.value = `รองรับเฉพาะไฟล์ ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()} เท่านั้น`
        file.value = null
        e.target.value = ''
        return
    }

    // Validate file size
    if (selected.size > MAX_FILE_SIZE_BYTES) {
        error.value = `ไฟล์มีขนาดเกิน ${MAX_FILE_SIZE_MB} MB`
        file.value = null
        e.target.value = ''
        return
    }

    error.value = null
    file.value = selected
    uploadProgress.value = 0
}

const handleUpload = async () => {
    if (!file.value) return
    
    loading.value = true
    error.value = null
    uploadProgress.value = 0
    uploadStage.value = 'Uploading...'
    
    try {
        await knowledgeStore.uploadKnowledge(file.value, type.value, (percent) => {
            uploadProgress.value = percent
            if (percent === 100) uploadStage.value = 'Processing...'
        })
        emit('success')
    } catch (e) {
        error.value = e.response?.data?.error || e.message || 'Upload failed'
    } finally {
        loading.value = false
        uploadStage.value = ''
    }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="knowledge-modal">
       <h2>Upload Knowledge</h2>
       
       <div class="form-group">
          <label>Select File (PDF, TXT)</label>
          <input type="file" @change="handleFileChange" accept=".pdf,.txt">
       </div>
       
       <div class="form-group">
          <label>Visibility</label>
          <select v-model="type">
              <option value="personal">Personal (Private)</option>
              <option v-if="isAdmin" value="department">Department</option>
              <option v-if="isAdmin" value="public">Public (All)</option>
          </select>
          <p class="hint" v-if="type === 'personal'">Only you can see this.</p>
          <p class="hint" v-if="type === 'department'">Visible to everyone in {{ authStore.department }}</p>
          <p class="hint" v-if="type === 'public'">Visible to everyone in the university.</p>
       </div>

       <!-- Progress Bar -->
       <div v-if="loading" class="upload-progress-container">
           <div class="upload-info">
               <span>{{ uploadStage }}</span>
               <span>{{ uploadProgress }}%</span>
           </div>
           <div class="upload-track">
               <div class="upload-fill" :style="{ width: uploadProgress + '%' }"></div>
           </div>
       </div>

       <div v-if="error" class="error">{{ error }}</div>

       <div class="actions">
           <button class="btn-cancel" @click="emit('close')">Cancel</button>
           <button class="btn-primary" @click="handleUpload" :disabled="!file || loading">
               {{ loading ? 'Processing...' : 'Upload' }}
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

.hint {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-top: 4px;
}

/* Upload Progress */
.upload-progress-container {
    margin-bottom: 16px;
    background: var(--color-bg-secondary);
    padding: 10px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
}

.upload-info {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    margin-bottom: 6px;
    color: var(--color-text-primary);
}

.upload-track {
    height: 6px;
    background: var(--color-bg-tertiary);
    border-radius: 3px;
    overflow: hidden;
}

.upload-fill {
    height: 100%;
    background: var(--color-accent);
    transition: width 0.3s ease;
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
