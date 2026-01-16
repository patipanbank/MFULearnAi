<script setup>
import { ref, watch } from 'vue'
import { useAutoResize } from '@/composables/useUtils'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: 'พิมพ์ข้อความของคุณ...'
  }
})

const emit = defineEmits(['update:modelValue', 'send'])

const textareaRef = ref(null)
const { resize } = useAutoResize(textareaRef)

const inputValue = ref(props.modelValue)

watch(() => props.modelValue, (val) => {
  inputValue.value = val
})

watch(inputValue, (val) => {
  emit('update:modelValue', val)
  resize()
})

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

defineExpose({
  focus: () => textareaRef.value?.focus()
})
</script>

<template>
  <div class="input-area">
    <div class="input-container glass">
      <div class="input-wrapper">
        <textarea 
          ref="textareaRef"
          v-model="inputValue"
          class="chat-input"
          :placeholder="placeholder"
          :disabled="disabled || loading"
          @keydown="handleKeydown"
          rows="1"
        ></textarea>
        
        <div class="input-actions">
          <button 
            class="btn-send"
            :class="{ active: inputValue.trim() }"
            :disabled="disabled || loading || !inputValue.trim()"
            @click="handleSend"
          >
            <svg v-if="!loading" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
            <div v-else class="spinner-small"></div>
          </button>
        </div>
      </div>
      
      <p class="input-disclaimer">
        <slot name="disclaimer">
          AI อาจให้ข้อมูลที่ไม่ถูกต้อง กรุณาตรวจสอบข้อมูลสำคัญอีกครั้ง
        </slot>
      </p>
    </div>
  </div>
</template>

<style scoped>
.input-area {
  padding: 20px;
  background: linear-gradient(to top, var(--color-bg-dark) 50%, transparent);
}

.input-container {
  max-width: 800px;
  margin: 0 auto;
  border-radius: 20px;
  padding: 16px;
}

.input-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 14px 18px;
  color: var(--color-text);
  font-size: 15px;
  resize: none;
  min-height: 48px;
  max-height: 150px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.chat-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.chat-input::placeholder {
  color: var(--color-text-muted);
}

.chat-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-send {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-send.active {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border: none;
  color: white;
  box-shadow: 0 4px 15px var(--glow-primary);
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-send svg {
  width: 20px;
  height: 20px;
}

.spinner-small {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.input-disclaimer {
  text-align: center;
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 12px;
}
</style>
