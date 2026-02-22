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
const MAX_FILES = 10

// State
const files = ref([]) // { file, name, size, status, progress, error }
const type = ref('personal')
const uploading = ref(false)
const error = ref(null)

// URL scraper state
const uploadMode = ref('file') // 'file' | 'url'
const urlInput = ref('')
const urlLoading = ref(false)

// Admin check — visibility options depend on this
const isAdmin = computed(() => {
    const role = authStore.role || authStore.user?.role
    return role === 'admin' || role === 'superadmin'
})

const canUpload = computed(() => {
    if (uploadMode.value === 'url') return urlInput.value.trim().length > 0 && !urlLoading.value
    return files.value.length > 0 && !uploading.value
})

const totalProgress = computed(() => {
    if (files.value.length === 0) return 0
    const sum = files.value.reduce((acc, f) => acc + (f.progress || 0), 0)
    return Math.round(sum / files.value.length)
})

const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || [])
    error.value = null

    for (const f of selected) {
        if (files.value.length >= MAX_FILES) {
            error.value = `Maximum ${MAX_FILES} files allowed`
            break
        }

        const ext = f.name.split('.').pop()?.toLowerCase()
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            error.value = `${f.name}: Only ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()} files supported`
            continue
        }

        if (f.size > MAX_FILE_SIZE_BYTES) {
            error.value = `${f.name}: File exceeds ${MAX_FILE_SIZE_MB} MB`
            continue
        }

        // Prevent duplicate by name
        if (files.value.some(existing => existing.name === f.name)) continue

        files.value.push({
            file: f,
            name: f.name,
            size: f.size,
            status: 'ready', // ready | uploading | done | error
            progress: 0,
            error: null
        })
    }

    // Reset input so same file can be re-selected
    e.target.value = ''
}

const removeFile = (index) => {
    files.value.splice(index, 1)
}

const handleDrop = (e) => {
    e.preventDefault()
    const dt = e.dataTransfer
    if (!dt?.files) return
    handleFileChange({ target: { files: dt.files } })
}

const handleDragOver = (e) => {
    e.preventDefault()
}

const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// Upload all files sequentially
const handleUpload = async () => {
    if (uploadMode.value === 'url') {
        await handleUrlScrape()
        return
    }

    if (files.value.length === 0) return
    uploading.value = true
    error.value = null
    let allSuccess = true

    for (const item of files.value) {
        if (item.status === 'done') continue

        item.status = 'uploading'
        item.progress = 0
        item.error = null

        try {
            await knowledgeStore.uploadKnowledge(item.file, type.value, (percent) => {
                item.progress = percent
            })
            item.status = 'done'
            item.progress = 100
        } catch (e) {
            item.status = 'error'
            item.error = e.response?.data?.error || e.message || 'Upload failed'
            allSuccess = false
        }
    }

    uploading.value = false

    if (allSuccess) {
        emit('success')
    }
}

// URL scraper
const handleUrlScrape = async () => {
    const url = urlInput.value.trim()
    if (!url) return

    // Basic URL validation
    try { new URL(url) } catch { error.value = 'Invalid URL format'; return }

    urlLoading.value = true
    error.value = null

    try {
        await knowledgeStore.createFromUrl(url, type.value)
        emit('success')
    } catch (e) {
        error.value = e.response?.data?.error || e.message || 'URL scraping failed'
    } finally {
        urlLoading.value = false
    }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="knowledge-modal">
       <h2>Upload Knowledge</h2>

       <!-- Mode Toggle -->
       <div class="mode-toggle">
         <button
           class="mode-btn"
           :class="{ active: uploadMode === 'file' }"
           @click="uploadMode = 'file'"
         >📄 File Upload</button>
         <button
           class="mode-btn"
           :class="{ active: uploadMode === 'url' }"
           @click="uploadMode = 'url'"
         >🔗 From URL</button>
       </div>

       <!-- File Upload Mode -->
       <template v-if="uploadMode === 'file'">
         <div class="form-group">
            <label>Select Files (PDF, TXT) — up to {{ MAX_FILES }}</label>
            <div
              class="drop-zone"
              @drop="handleDrop"
              @dragover="handleDragOver"
              @click="$refs.fileInput.click()"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span>Drop files here or click to browse</span>
            </div>
            <input
              ref="fileInput"
              type="file"
              multiple
              @change="handleFileChange"
              accept=".pdf,.txt"
              style="display: none"
            >
         </div>

         <!-- File List -->
         <div v-if="files.length" class="file-list">
           <div v-for="(item, idx) in files" :key="idx" class="file-item" :class="item.status">
             <div class="file-info">
               <span class="file-name">{{ item.name }}</span>
               <span class="file-size">{{ formatSize(item.size) }}</span>
             </div>
             <div class="file-actions">
               <span v-if="item.status === 'done'" class="status-icon done">✓</span>
               <span v-else-if="item.status === 'error'" class="status-icon error" :title="item.error">✗</span>
               <span v-else-if="item.status === 'uploading'" class="status-icon uploading">{{ item.progress }}%</span>
               <button v-else class="btn-remove" @click="removeFile(idx)">×</button>
             </div>
             <!-- Individual progress bar -->
             <div v-if="item.status === 'uploading'" class="file-progress">
               <div class="file-progress-fill" :style="{ width: item.progress + '%' }"></div>
             </div>
           </div>
         </div>
       </template>

       <!-- URL Mode -->
       <template v-if="uploadMode === 'url'">
         <div class="form-group">
           <label>Website URL</label>
           <input
             v-model="urlInput"
             type="url"
             placeholder="https://example.com/page"
             class="url-input"
           />
           <p class="hint">The page content will be extracted and saved as knowledge.</p>
         </div>
       </template>

       <!-- Visibility (shared) -->
       <div class="form-group">
          <label>Visibility</label>
          <select v-model="type">
              <option value="personal">Personal (Private)</option>
              <option v-if="isAdmin" value="department">Department</option>
              <option v-if="isAdmin" value="public">Public (All)</option>
              <option v-if="isAdmin" value="policy">Policy (System)</option>
          </select>
          <p class="hint" v-if="type === 'personal'">Only you can see this.</p>
          <p class="hint" v-if="type === 'department'">Visible to everyone in {{ authStore.department }}</p>
          <p class="hint" v-if="type === 'public'">Visible to everyone in the university.</p>
          <p class="hint" v-if="type === 'policy'">Enforced system-wide context (Admin Only).</p>
       </div>

       <!-- Overall Progress -->
       <div v-if="uploading" class="upload-progress-container">
           <div class="upload-info">
               <span>Uploading {{ files.filter(f => f.status === 'done').length }}/{{ files.length }}...</span>
               <span>{{ totalProgress }}%</span>
           </div>
           <div class="upload-track">
               <div class="upload-fill" :style="{ width: totalProgress + '%' }"></div>
           </div>
       </div>

       <div v-if="urlLoading" class="upload-progress-container">
           <div class="upload-info">
               <span>Scraping page...</span>
           </div>
           <div class="upload-track">
               <div class="upload-fill indeterminate"></div>
           </div>
       </div>

       <div v-if="error" class="error">{{ error }}</div>

       <div class="actions">
           <button class="btn-cancel" @click="emit('close')">Cancel</button>
           <button class="btn-primary" @click="handleUpload" :disabled="!canUpload">
               {{ uploading || urlLoading ? 'Processing...' : uploadMode === 'url' ? 'Import' : `Upload (${files.length})` }}
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
    width: 480px;
    max-height: 85vh;
    overflow-y: auto;
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

h2 { margin-top: 0; font-size: 18px; }

/* Mode Toggle */
.mode-toggle {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: var(--color-bg-tertiary);
  padding: 3px;
  border-radius: 8px;
}

.mode-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.mode-btn.active {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* Drop Zone */
.drop-zone {
  border: 2px dashed var(--color-border);
  border-radius: 10px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--color-text-muted);
}
.drop-zone:hover {
  border-color: var(--color-accent, #6366f1);
  background: rgba(99, 102, 241, 0.05);
}
.drop-zone span { font-size: 13px; }

/* File List */
.file-list {
  margin-bottom: 16px;
  max-height: 200px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-bottom: 6px;
  background: var(--color-bg-secondary);
  transition: all 0.15s;
}
.file-item.done { border-color: rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.05); }
.file-item.error { border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.05); }

.file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 11px;
  color: var(--color-text-muted);
}

.file-actions { flex-shrink: 0; }

.btn-remove {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}
.btn-remove:hover { color: #ef4444; }

.status-icon {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}
.status-icon.done { color: #10b981; }
.status-icon.error { color: #ef4444; }
.status-icon.uploading { color: var(--color-accent, #6366f1); }

.file-progress {
  width: 100%;
  height: 3px;
  background: var(--color-bg-tertiary);
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}

.file-progress-fill {
  height: 100%;
  background: var(--color-accent);
  transition: width 0.3s;
}

/* URL Input */
.url-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}
.url-input:focus { border-color: var(--color-accent, #6366f1); }

/* Form */
.form-group { margin-bottom: 16px; }

label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
}

select {
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

.upload-fill.indeterminate {
    width: 40%;
    animation: indeterminate 1.5s ease-in-out infinite;
}
@keyframes indeterminate {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(350%); }
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
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.error { color: #ef4444; font-size: 13px; margin-bottom: 12px; }
</style>
