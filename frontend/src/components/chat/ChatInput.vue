<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  t: { type: Function, required: true }
})

const emit = defineEmits(['update:modelValue', 'send', 'upload'])

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

defineExpose({
  focus: () => document.querySelector('.chat-input')?.focus()
})
</script>

<template>
  <div class="input-area">
    <div class="input-container">
      <div class="input-row">
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
          :class="{ active: inputValue.trim() }"
          :disabled="disabled || loading || !inputValue.trim()"
          @click="handleSend"
        >
          <svg v-if="!loading" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
          <div v-else class="spinner"></div>
        </button>
      </div>
      
      <p class="disclaimer">{{ t('disclaimer') }}</p>
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

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--color-bg-secondary);
  border: 1px solid transparent; /* Hidden border */
  border-radius: var(--radius-lg);
  padding: 8px;
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

.disclaimer {
  text-align: center;
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 10px;
}

/* Responsive */
@media (max-width: 768px) {
  .input-area {
    padding: 12px 16px 20px;
  }
}
</style>
