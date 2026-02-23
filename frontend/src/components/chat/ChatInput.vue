<script setup>
import { ref, watch, computed, nextTick, onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { FileText, FileSpreadsheet, FileImage, File } from 'lucide-vue-next'
import { useConfirmDialog } from '@/composables/useConfirmDialog'

const { alert: showAlert } = useConfirmDialog()

const chatStore = useChatStore()

// Upload constraints — aligned with nginx client_max_body_size (100M)
const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const MAX_TOTAL_SIZE_MB = 100
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024
const MAX_FILE_COUNT = 10

const props = defineProps({
  modelValue: { type: String, default: '' },
  attachments: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  streaming: { type: Boolean, default: false },
  t: { type: Function, required: true }
})

const emit = defineEmits(['update:modelValue', 'send', 'upload', 'remove-attachment', 'stop'])

const fileInputRef = ref(null)
const textareaRef = ref(null)
const inputValue = ref(props.modelValue)
const isFocused = ref(false)

watch(() => props.modelValue, (val) => { inputValue.value = val })
watch(inputValue, (val) => {
  emit('update:modelValue', val)
  nextTick(() => autoResize())
})

const autoResize = () => {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

onMounted(() => autoResize())

const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

const handleSend = () => {
  if (props.streaming) { emit('stop'); return }
  if (props.disabled || props.loading) return
  // Allow sending if there's text OR attachments
  const hasText = inputValue.value.trim().length > 0
  const hasAttachments = props.attachments && props.attachments.length > 0
  if (!hasText && !hasAttachments) return
  emit('send', inputValue.value)
  inputValue.value = ''
  nextTick(() => autoResize())
}

const handleFileClick = () => fileInputRef.value?.click()

// ── Paste handler: supports pasting images and files from clipboard ──
const handlePaste = (e) => {
  const items = e.clipboardData?.items
  if (!items) return

  const files = []
  for (const item of items) {
    // Handle pasted images / files
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }

  if (files.length > 0) {
    e.preventDefault()

    // Validate file count
    const currentCount = props.attachments?.length || 0
    if (currentCount + files.length > MAX_FILE_COUNT) {
      showAlert(`สามารถแนบไฟล์ได้สูงสุด ${MAX_FILE_COUNT} ไฟล์`, { variant: 'warning' })
      return
    }

    // Validate individual file size and total
    let totalSize = (props.attachments || []).reduce((sum, a) => sum + (a.size || 0), 0)
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showAlert(`ไฟล์ "${file.name}" มีขนาดเกิน ${MAX_FILE_SIZE_MB} MB`, { variant: 'warning' })
        return
      }
      totalSize += file.size
    }
    if (totalSize > MAX_TOTAL_SIZE_BYTES) {
      showAlert(`ขนาดไฟล์รวมเกิน ${MAX_TOTAL_SIZE_MB} MB`, { variant: 'warning' })
      return
    }

    emit('upload', files)
  }
  // If no files, let the default paste behavior handle text
}

const handleFileChange = (e) => {
  const files = e.target.files
  if (!files?.length) return

  // Validate file count
  const currentCount = props.attachments?.length || 0
  if (currentCount + files.length > MAX_FILE_COUNT) {
    showAlert(`สามารถแนบไฟล์ได้สูงสุด ${MAX_FILE_COUNT} ไฟล์`, { variant: 'warning' })
    e.target.value = ''
    return
  }

  // Validate individual file size and total
  let totalSize = (props.attachments || []).reduce((sum, a) => sum + (a.size || 0), 0)
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showAlert(`ไฟล์ "${file.name}" มีขนาดเกิน ${MAX_FILE_SIZE_MB} MB`, { variant: 'warning' })
      e.target.value = ''
      return
    }
    totalSize += file.size
  }
  if (totalSize > MAX_TOTAL_SIZE_BYTES) {
    showAlert(`ขนาดไฟล์รวมเกิน ${MAX_TOTAL_SIZE_MB} MB`, { variant: 'warning' })
    e.target.value = ''
    return
  }

  emit('upload', files)
  e.target.value = ''
}

const canSend = computed(() =>
  inputValue.value.trim() || (props.attachments && props.attachments.length > 0) || props.streaming
)

const healthStatus = computed(() => {
  const len = chatStore.messages.length
  if (len < 8) return 'safe'
  if (len < 12) return 'medium'
  return 'heavy'
})

const healthPercent = computed(() => {
  const len = chatStore.messages.length
  return Math.min((len / 16) * 100, 100)
})

const healthLabel = computed(() => {
  const len = chatStore.messages.length
  if (len < 8) return 'Context healthy'
  if (len < 12) return 'Moderate usage'
  return 'Pruning active'
})

const getFileIcon = (file) => {
  if (file.type === 'image') return { component: FileImage, color: '#10b981' }
  const ext = file.name?.split('.').pop()?.toLowerCase()
  const map = {
    pdf:  { component: FileText,        color: '#ef4444' },
    doc:  { component: FileText,        color: '#3b82f6' },
    docx: { component: FileText,        color: '#3b82f6' },
    txt:  { component: FileText,        color: '#6b7280' },
    xls:  { component: FileSpreadsheet, color: '#22c55e' },
    xlsx: { component: FileSpreadsheet, color: '#22c55e' },
    csv:  { component: FileSpreadsheet, color: '#22c55e' },
  }
  return map[ext] || { component: File, color: '#9ca3af' }
}

defineExpose({
  focus: () => textareaRef.value?.focus()
})
</script>

<template>
  <div class="input-area">
    <div class="input-container">

      <!-- Main Input Panel -->
      <div class="input-panel" :class="{ focused: isFocused }">

        <!-- Attachments Row -->
        <div v-if="attachments && attachments.length > 0" class="attachments-row">
          <div
            v-for="(file, index) in attachments"
            :key="index"
            class="attachment-chip"
          >
            <div v-if="file.type === 'image'" class="chip-thumb">
              <img :src="file.data" />
            </div>
            <div v-else class="chip-icon">
              <component
                :is="getFileIcon(file).component"
                :color="getFileIcon(file).color"
                :size="20"
              />
            </div>
            <span class="chip-name">{{ file.name }}</span>
            <button class="chip-remove" @click="$emit('remove-attachment', index)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Input Row -->
        <div class="input-row">
          <button
            class="btn-attach"
            @click="handleFileClick"
            :title="t('uploadFile')"
            :disabled="disabled || streaming"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>

          <input
            ref="fileInputRef"
            type="file"
            class="file-input"
            @change="handleFileChange"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.csv"
          />

          <textarea
            ref="textareaRef"
            v-model="inputValue"
            class="chat-input"
            :placeholder="t('typeMessage')"
            :disabled="disabled || loading || streaming"
            @keydown="handleKeydown"
            @paste="handlePaste"
            @focus="isFocused = true"
            @blur="isFocused = false"
            rows="1"
          />

          <!-- Send / Stop Button -->
          <button
            class="btn-send"
            :class="{
              'can-send': canSend && !loading,
              'is-streaming': streaming,
              'is-loading': loading
            }"
            :disabled="(disabled && !streaming) || loading || (!canSend)"
            @click="handleSend"
          >
            <!-- Loading spinner -->
            <span v-if="loading" class="spinner" />

            <!-- Stop icon -->
            <svg v-else-if="streaming" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="5" width="14" height="14" rx="2"/>
            </svg>

            <!-- Send icon -->
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Footer -->
      <div class="input-footer">
        <!-- Context Health Bar -->
        <div v-if="chatStore.messages.length > 0" class="context-health">
          <div class="health-bar-track">
            <div
              class="health-bar-fill"
              :class="healthStatus"
              :style="{ width: healthPercent + '%' }"
            />
          </div>
          <span class="health-label" :class="healthStatus">{{ healthLabel }}</span>
        </div>

        <p class="disclaimer">{{ t('disclaimer') }}</p>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ── Layout ── */
.input-area {
  padding: 12px 24px 20px;
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  background: var(--color-bg-primary);
}

.input-container {
  max-width: 768px;
  margin: 0 auto;
}

/* ── Main Panel ── */
.input-panel {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 8px 8px 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input-panel.focused {
  border-color: var(--color-accent, #8b5cf6);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--color-accent, #8b5cf6) 12%, transparent),
    0 2px 12px rgba(0, 0, 0, 0.08);
}

/* ── Attachments ── */
.attachments-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.attachment-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 4px 8px 4px 4px;
  max-width: 180px;
  position: relative;
}

.chip-thumb {
  width: 32px;
  height: 32px;
  border-radius: 5px;
  overflow: hidden;
  flex-shrink: 0;
}

.chip-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chip-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.chip-name {
  font-size: 11px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.chip-remove {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-bg-tertiary);
  border: none;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.chip-remove:hover {
  background: var(--color-error, #ef4444);
  color: white;
}

/* ── Input Row ── */
.input-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.file-input { display: none; }

/* ── Attach Button ── */
.btn-attach {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
  margin-bottom: 2px;
}

.btn-attach:hover:not(:disabled) {
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.btn-attach:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Textarea ── */
.chat-input {
  flex: 1;
  background: transparent;
  border: none;
  padding: 8px 4px;
  color: var(--color-text-primary);
  font-size: 15px;
  resize: none;
  min-height: 36px;
  max-height: 200px;
  font-family: inherit;
  line-height: 1.6;
  overflow-y: auto;
}

.chat-input:focus { outline: none; }

.chat-input::placeholder { color: var(--color-text-muted); }

.chat-input:disabled { opacity: 0.5; }

/* ── Send Button ── */
.btn-send {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  border: none;
  border-radius: 10px;
  color: var(--color-text-muted);
  cursor: not-allowed;
  transition: background 0.2s, color 0.2s, transform 0.1s;
  flex-shrink: 0;
  margin-bottom: 2px;
}

.btn-send.can-send {
  background: var(--color-text-primary);
  color: var(--color-bg-primary);
  cursor: pointer;
}

.btn-send.can-send:hover {
  transform: scale(1.05);
  opacity: 0.9;
}

.btn-send.can-send:active {
  transform: scale(0.95);
}

.btn-send.is-streaming {
  background: var(--color-error, #ef4444);
  color: white;
  cursor: pointer;
}

.btn-send.is-loading {
  cursor: not-allowed;
}

.btn-send:disabled:not(.is-streaming) {
  opacity: 0.5;
}

/* Spinner */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
  display: block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Footer ── */
.input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  gap: 12px;
}

/* Context Health Bar */
.context-health {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.health-bar-track {
  width: 56px;
  height: 3px;
  background: var(--color-border);
  border-radius: 99px;
  overflow: hidden;
}

.health-bar-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.4s ease, background 0.3s ease;
}

.health-bar-fill.safe   { background: #10b981; }
.health-bar-fill.medium { background: #f59e0b; }
.health-bar-fill.heavy  { background: #ef4444; }

.health-label {
  font-size: 11px;
  font-weight: 500;
  transition: color 0.3s;
}

.health-label.safe   { color: #10b981; }
.health-label.medium { color: #f59e0b; }
.health-label.heavy  { color: #ef4444; }

.disclaimer {
  font-size: 11px;
  color: var(--color-text-muted);
  margin: 0;
  text-align: right;
  flex: 1;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .input-area {
    padding: 8px 12px 16px;
  }

  .input-panel {
    border-radius: 14px;
    padding: 6px 6px 6px 10px;
  }

  .chat-input {
    font-size: 16px; /* prevent iOS zoom */
  }

  .btn-attach,
  .btn-send {
    width: 34px;
    height: 34px;
  }

  .health-bar-track {
    display: none;
  }
}
</style>