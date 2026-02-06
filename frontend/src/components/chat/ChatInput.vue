<script setup>
import { ref, watch, computed } from 'vue'
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()

const props = defineProps({
  modelValue: { type: String, default: '' },
  attachments: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  t: { type: Function, required: true }
})

const emit = defineEmits(['update:modelValue', 'send', 'upload', 'remove-attachment'])

const fileInputRef = ref(null)
const inputValue = ref(props.modelValue)

watch(() => props.modelValue, (val) => { inputValue.value = val })
watch(inputValue, (val) => { emit('update:modelValue', val) })

const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

const handleSend = () => {
  if (!inputValue.value.trim() || props.disabled || props.loading) return
  emit('send', inputValue.value)
  inputValue.value = ''
}

const handleFileClick = () => {
  fileInputRef.value?.click()
}

const handleFileChange = (e) => {
  const files = e.target.files
  if (files?.length) {
    emit('upload', files)
    e.target.value = ''
  }
}

const healthStatus = computed(() => {
    const len = chatStore.messages.length
    if (len < 8) return 'safe'
    if (len < 12) return 'medium'
    return 'heavy'
})

const healthLabel = computed(() => {
    const len = chatStore.messages.length
    if (len < 8) return 'Perfect context'
    if (len < 12) return 'Moderate context'
    return 'Context pruning active'
})

defineExpose({
  focus: () => document.querySelector('.chat-input')?.focus()
})
</script>

<template>
  <div class="input-area">
    <div class="input-container">
      
      <!-- Combined Input Wrapper -->
      <div class="input-wrapper">
          <!-- Attachments (Inside) -->
          <div v-if="attachments && attachments.length > 0" class="attachments-preview">
            <div v-for="(file, index) in attachments" :key="index" class="attachment-item">
                <div v-if="file.type === 'image'" class="thumb-wrapper">
                    <img :src="file.data" class="attachment-thumb" />
                </div>
                <div v-else class="file-icon-wrapper">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                </div>
                <span v-if="file.type !== 'image'" class="file-name">{{ file.name }}</span>
                <button class="btn-remove" @click="$emit('remove-attachment', index)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
          </div>

          <div class="input-controls">
            <!-- File Upload Button -->
            <button 
              class="btn-attach" 
              @click="handleFileClick"
              :title="t('uploadFile')"
              :disabled="disabled"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <input
              ref="fileInputRef"
              type="file"
              class="file-input"
              @change="handleFileChange"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
            
            <!-- Text Input -->
            <textarea 
              v-model="inputValue"
              class="chat-input"
              :placeholder="t('typeMessage')"
              :disabled="disabled || loading"
              @keydown="handleKeydown"
              rows="1"
            ></textarea>
            
            <!-- Send Button -->
            <button 
              class="btn-send"
              :class="{ active: inputValue.trim() || (attachments && attachments.length > 0) }"
              :disabled="disabled || loading || (!inputValue.trim() && (!attachments || attachments.length === 0))"
              @click="handleSend"
            >
              <svg v-if="!loading" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
              <div v-else class="spinner"></div>
            </button>
          </div>
      </div>
      
      <div class="input-footer">
        <div class="context-health" v-if="chatStore.messages.length > 0">
            <span class="dot" :class="healthStatus"></span>
            <span class="health-text">{{ healthLabel }}</span>
        </div>
        <p class="disclaimer">{{ t('disclaimer') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.input-area {
  padding: 16px 24px 24px;
  /* border-top: 1px solid var(--color-border); */
  background: var(--color-bg-primary);
}

.input-container {
  max-width: 768px;
  margin: 0 auto;
}

.input-wrapper {
  background: var(--color-bg-secondary);
  border: 1px solid transparent; 
  border-radius: var(--radius-lg);
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.input-controls {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

/* Attachments inside Input */
.attachments-preview {
    display: flex;
    gap: 10px;
    padding-bottom: 12px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--color-border);
    overflow-x: auto;
}

.attachment-item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--color-bg-primary); /* Contrast against secondary */
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 6px;
    width: 72px;
    flex-shrink: 0;
}

.thumb-wrapper {
    width: 50px;
    height: 50px;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 4px;
}

.attachment-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.file-icon-wrapper {
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
}

.file-name {
    font-size: 9px;
    text-align: center;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-primary);
}

.btn-remove {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 10px;
    z-index: 2;
}

.btn-remove:hover {
    background: var(--color-error);
    color: white;
    border-color: var(--color-error);
}

.file-input {
  display: none;
}

.btn-attach {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all 0.15s;
  flex-shrink: 0;
}

.btn-attach:hover:not(:disabled) {
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.btn-attach:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-input {
  flex: 1;
  background: transparent;
  border: none;
  padding: 10px 4px;
  color: var(--color-text-primary);
  font-size: 14px;
  resize: none;
  min-height: 40px;
  max-height: 120px;
  font-family: inherit;
  line-height: 1.5;
}

.chat-input:focus {
  outline: none;
}

.chat-input::placeholder {
  color: var(--color-text-muted);
}

.chat-input:disabled {
  opacity: 0.6;
}

.btn-send {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.btn-send.active {
  background: var(--color-accent);
  color: white;
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.input-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 10px;
}

.disclaimer {
  text-align: right;
  font-size: 11px;
  color: var(--color-text-muted);
  margin: 0;
  flex: 1;
}

.context-health {
    display: flex;
    align-items: center;
    gap: 6px;
}

.context-health .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    transition: background 0.3s;
}

.context-health .dot.safe { background: #10b981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.4); }
.context-health .dot.medium { background: #f59e0b; box-shadow: 0 0 6px rgba(245, 158, 11, 0.4); }
.context-health .dot.heavy { background: #ef4444; box-shadow: 0 0 6px rgba(239, 68, 68, 0.4); }

.health-text {
    font-size: 10px;
    color: var(--color-text-muted);
    font-weight: 500;
}

/* Responsive */
@media (max-width: 768px) {
  .input-area {
    padding: 12px 16px 20px;
  }
  
  .input-row {
    padding: 6px;
  }
  
  .btn-attach, .btn-send {
    width: 36px;
    height: 36px;
  }
}
</style>
