<script setup>
import { ref, computed } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useAuthStore } from '@/stores/auth'
import { useLanguage } from '@/composables/useSettings'
import { useModalKeyboard } from '@/composables/useModalKeyboard'

const emit = defineEmits(['close', 'success'])
const knowledgeStore = useKnowledgeStore()
const authStore = useAuthStore()

// --- Global i18n Translation ---
const { t } = useLanguage()

// ── Keyboard support ──
const modalRef = ref(null)
useModalKeyboard({
  onClose: () => emit('close'),
  modalRef,
})

// Upload constraints — aligned with nginx client_max_body_size (100M) for knowledge route
const MAX_FILE_SIZE_MB = 50
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const ALLOWED_EXTENSIONS = [
    // Documents
    'pdf', 'doc', 'docx', 'rtf',
    // Spreadsheets
    'xls', 'xlsx', 'csv',
    // Text & Code
    'txt', 'md', 'html', 'css', 'js', 'ts', 'json', 'xml', 'yaml', 'yml', 'py', 'c', 'cpp', 'h', 'java', 'go', 'rs', 'php', 'rb', 'sh',
    // Images
    'png', 'jpg', 'jpeg', 'tiff'
]
const MAX_FILES = 10

// State
const files = ref([]) // { file, name, size, status, progress, error }
const type = ref('personal')
const folder = ref('')
const expiresAt = ref('')
const uploading = ref(false)
const error = ref(null)

// Mode state: 'file' | 'url' | 'text'
const uploadMode = ref('file')

// URL state
const urlInput = ref('')
const urlLoading = ref(false)

const isGoogleDriveUrl = computed(() => /docs\.google\.com\/(spreadsheets|document|presentation)/.test(urlInput.value))

// URL validation state
const urlValidation = computed(() => {
    const url = urlInput.value.trim()
    if (!url) return { valid: false, message: '' }
    if (url.length > 2048) return { valid: false, message: 'URL is too long (max 2048 characters)' }
    try {
        const parsed = new URL(url)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return { valid: false, message: `Protocol "${parsed.protocol}" not supported. Use http:// or https://` }
        }
        // Warn about internal URLs (the server will block these anyway)
        const hostname = parsed.hostname.toLowerCase()
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
            return { valid: false, message: 'Internal/private URLs are not allowed' }
        }
        return { valid: true, message: '' }
    } catch {
        return { valid: false, message: 'Invalid URL format' }
    }
})

// Enterprise: Structured error parser for upload responses
const parseUploadError = (e) => {
    const status = e.response?.status
    const data = e.response?.data

    if (status === 429) {
        const retryAfter = e.response?.headers?.['retry-after']
        const retryMsg = retryAfter ? ` (wait ${retryAfter}s)` : ''
        return `Rate limit exceeded — too many uploads${retryMsg}. Please try again later.`
    }
    if (status === 413) {
        return 'File too large — exceeds server limit.'
    }
    if (status === 422 || status === 400) {
        return data?.error || 'Invalid file or input. Check file type and size.'
    }
    if (status === 403) {
        return 'Permission denied — you do not have access to upload this type.'
    }
    if (status >= 500) {
        return 'Server error — please try again later or contact support.'
    }
    return data?.error || e.message || 'Upload failed'
}

// Text state
const textTitle = ref('')
const textContent = ref('')
const textLoading = ref(false)

// Admin check — visibility options depend on this
const isAdmin = computed(() => {
    const role = authStore.role || authStore.user?.role
    return role === 'admin' || role === 'superadmin'
})

const canUpload = computed(() => {
    if (uploadMode.value === 'url') return urlInput.value.trim().length > 0 && urlValidation.value.valid && !urlLoading.value
    if (uploadMode.value === 'text') return textTitle.value.trim().length > 0 && textContent.value.trim().length > 0 && !textLoading.value
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

// Upload Router
const handleUpload = async () => {
    if (uploadMode.value === 'url') {
        await handleUrlScrape()
        return
    }
    if (uploadMode.value === 'text') {
        await handleTextUpload()
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
            await knowledgeStore.uploadKnowledge(item.file, type.value, folder.value.trim(), expiresAt.value, (percent) => {
                item.progress = percent
            }, { skipRefresh: true })
            item.status = 'done'
            item.progress = 100
        } catch (e) {
            item.status = 'error'
            item.error = parseUploadError(e)
            allSuccess = false
            // Stop batch on rate limit — don't burn remaining attempts
            if (e.response?.status === 429) {
                error.value = item.error
                break
            }
        }
    }

    uploading.value = false

    if (allSuccess) {
        await knowledgeStore.fetchKnowledge()
        emit('success')
    }
}

// URL scraper
const handleUrlScrape = async () => {
    // Guard against double-submit (Vue reactivity updates :disabled async)
    if (urlLoading.value) return

    const url = urlInput.value.trim()
    if (!url) return

    // Use the computed validation
    if (!urlValidation.value.valid) {
        error.value = urlValidation.value.message || 'Invalid URL'
        return
    }

    urlLoading.value = true
    error.value = null

    try {
        await knowledgeStore.createFromUrl(urlInput.value.trim(), type.value, folder.value.trim(), expiresAt.value)
        emit('success')
    } catch (e) {
        error.value = parseUploadError(e)
    } finally {
        urlLoading.value = false
    }
}

// Text Upload
const handleTextUpload = async () => {
    const title = textTitle.value.trim()
    const content = textContent.value.trim()
    if (!title || !content) return

    textLoading.value = true
    error.value = null

    try {
        await knowledgeStore.createFromText(title, content, type.value, folder.value.trim(), expiresAt.value)
        emit('success')
    } catch (e) {
        error.value = parseUploadError(e)
    } finally {
        textLoading.value = false
    }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div ref="modalRef" class="knowledge-modal">
       
       <div class="modal-header">
         <h2>{{ t('uploadTitle') }}</h2>
         <!-- Removed local language toggle, users control language from settings menu -->
       </div>

       <!-- Mode Toggle -->
       <div class="mode-toggle">
         <button
           class="mode-btn"
           :class="{ active: uploadMode === 'file' }"
           @click="uploadMode = 'file'"
         >{{ t('fileUploadMode') }}</button>
         <button
           class="mode-btn"
           :class="{ active: uploadMode === 'text' }"
           @click="uploadMode = 'text'"
         >{{ t('rawTextMode') }}</button>
         <button
           class="mode-btn"
           :class="{ active: uploadMode === 'url' }"
           @click="uploadMode = 'url'"
         >{{ t('fromUrlMode') }}</button>
       </div>

       <!-- File Upload Mode -->
       <template v-if="uploadMode === 'file'">
         <div class="form-group">
            <label>{{ t('selectFilesLimit') }} {{ MAX_FILES }}</label>
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
              <span>{{ t('dropFilesHint') }}</span>
            </div>
            <input
              ref="fileInput"
              type="file"
              multiple
              @change="handleFileChange"
              accept=".pdf,.doc,.docx,.rtf,.xls,.xlsx,.csv,.txt,.md,.html,.css,.js,.ts,.json,.xml,.yaml,.yml,.py,.c,.cpp,.h,.java,.go,.rs,.php,.rb,.sh,.png,.jpg,.jpeg,.tiff"
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
           <label>{{ t('websiteUrlLabel') }}</label>
           <input
             v-model="urlInput"
             type="url"
             :placeholder="t('urlInputPlaceholder')"
             class="url-input"
             :class="{ 'url-input--invalid': urlInput.trim() && !urlValidation.valid }"
             maxlength="2048"
           />
           <p v-if="urlInput.trim() && !urlValidation.valid" class="hint hint--error">{{ urlValidation.message }}</p>
           <p class="hint">{{ t('urlExtractionHint') }}</p>
           <p v-if="isGoogleDriveUrl" class="hint hint--warning">
             ⚠️ Google Drive: ตรวจสอบให้แน่ใจว่าไฟล์ถูกแชร์เป็น <strong>"ทุกคนที่มีลิงก์สามารถดู"</strong> ก่อนอัปโหลด
           </p>
           <div class="url-supported-types">
             <span class="url-type-label">Supported:</span>
             <span class="url-type-badge">Websites</span>
             <span class="url-type-badge badge--google">Google Sheets</span>
             <span class="url-type-badge badge--google">Google Docs</span>
             <span class="url-type-badge badge--google">Google Slides</span>
           </div>
         </div>
       </template>

       <!-- Raw Text Mode -->
       <template v-if="uploadMode === 'text'">
         <div class="form-group">
           <label>{{ t('docTitleLabel') }}</label>
           <input
             v-model="textTitle"
             type="text"
             :placeholder="t('docTitlePlaceholder')"
             class="form-control"
           />
         </div>
         <div class="form-group">
           <label>{{ t('textContentLabel') }}</label>
           <textarea
             v-model="textContent"
             :placeholder="t('textInputPlaceholder')"
             class="form-control text-area-input"
             rows="8"
           ></textarea>
           <p class="hint">{{ t('textConversionHint') }}</p>
         </div>
       </template>

       <!-- Visibility (shared) -->
       <div class="form-group">
           <label>{{ t('visibilityLabel') }}</label>
           <select v-model="type" class="form-control">
               <option value="personal">{{ t('visPersonalOpt') }}</option>
               <option v-if="isAdmin" value="department">{{ t('visDeptOpt') }}</option>
               <option v-if="isAdmin" value="public">{{ t('visPublicOpt') }}</option>
               <option v-if="isAdmin" value="policy">{{ t('visPolicyOpt') }}</option>
           </select>
           <p class="hint" v-if="type === 'personal'">{{ t('hintVisPersonal') }}</p>
           <p class="hint" v-if="type === 'department'">{{ t('hintVisDept') }} {{ authStore.department }}</p>
           <p class="hint" v-if="type === 'public'">{{ t('hintVisPublic') }}</p>
           <p class="hint" v-if="type === 'policy'">{{ t('hintVisPolicy') }}</p>
       </div>

       <!-- Optional Organization & Expiry -->
       <div class="form-row">
         <div class="form-group flex-1">
           <label>{{ t('folderPathLabel') }}</label>
           <input v-model="folder" type="text" :placeholder="t('folderPathPlaceholder')" class="form-control" />
           <p class="hint">{{ t('folderPathHint') }}</p>
         </div>
         <div class="form-group flex-1">
           <label>{{ t('expiryDateLabel') }}</label>
           <input v-model="expiresAt" type="date" class="form-control" />
           <p class="hint">{{ t('expiryDateHint') }}</p>
         </div>
       </div>

       <!-- Overall Progress -->
       <div v-if="uploading" class="upload-progress-container">
           <div class="upload-info">
               <span>{{ t('uploadingStatus') }} {{ files.filter(f => f.status === 'done').length }}/{{ files.length }}...</span>
               <span>{{ totalProgress }}%</span>
           </div>
           <div class="upload-track">
               <div class="upload-fill" :style="{ width: totalProgress + '%' }"></div>
           </div>
       </div>

       <div v-if="urlLoading" class="upload-progress-container">
           <div class="upload-info">
               <span>{{ t('scrapingStatus') }}</span>
           </div>
           <div class="upload-track">
               <div class="upload-fill indeterminate"></div>
           </div>
       </div>

       <div v-if="textLoading" class="upload-progress-container">
           <div class="upload-info">
               <span>{{ t('pastingStatus') }}</span>
           </div>
           <div class="upload-track">
               <div class="upload-fill indeterminate"></div>
           </div>
       </div>

       <div v-if="error" class="error" :class="{ 'error--warning': error.includes('Rate limit') || error.includes('wait') }">
         <span class="error-icon">{{ error.includes('Rate limit') ? '⏱' : '⚠' }}</span>
         {{ error }}
       </div>

       <div class="actions">
           <button class="btn-cancel" @click="emit('close')">{{ t('cancelBtn') }}</button>
           <button class="btn-primary" @click="handleUpload" :disabled="!canUpload">
               {{ uploading || urlLoading || textLoading ? t('processingBtn') : (uploadMode === 'url' || uploadMode === 'text') ? t('importBtn') : `${t('uploadBtnText')} (${files.length})` }}
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

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.modal-header h2 { 
    margin: 0; 
    font-size: 18px; 
}

/* Lang Toggle */
.lang-toggle {
    display: flex;
    background: var(--color-bg-secondary);
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--color-border);
}
.lang-toggle button {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}
.lang-toggle button:hover {
    color: var(--color-text-primary);
}
.lang-toggle button.active {
    background: var(--color-accent, #6366f1);
    color: white;
}

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
.url-input--invalid { border-color: #ef4444 !important; }
.url-input--invalid:focus { border-color: #ef4444 !important; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15); }

/* URL Supported Types badges */
.url-supported-types {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.url-type-label {
  font-size: 11px;
  color: var(--color-text-muted);
  font-weight: 500;
}
.url-type-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}
.badge--google {
  background: rgba(66, 133, 244, 0.08);
  border-color: rgba(66, 133, 244, 0.2);
  color: #4285f4;
}

/* Form */
.form-group { margin-bottom: 16px; }

label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
}

.form-control, select, .url-input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
}
.form-control:focus, select:focus, .url-input:focus {
    border-color: var(--color-accent, #6366f1);
}
/* Ensure dark-mode compatibility for date pickers */
input[type="date"].form-control {
    color: var(--color-text-primary);
    color-scheme: dark light;
}

.text-area-input {
    resize: vertical;
    min-height: 100px;
}

.form-row {
    display: flex;
    gap: 12px;
}
.flex-1 {
    flex: 1;
}

.hint {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-top: 4px;
}

.hint--warning {
    color: #b45309;
    background: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 4px;
    padding: 6px 8px;
    margin-top: 6px;
}

.hint--error {
    color: #ef4444;
    font-weight: 500;
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

.error {
  color: #ef4444;
  font-size: 13px;
  margin-bottom: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.error--warning {
  color: #d97706;
  background: rgba(217, 119, 6, 0.08);
  border-color: rgba(217, 119, 6, 0.2);
}
.error-icon {
  flex-shrink: 0;
  font-size: 14px;
}
</style>
