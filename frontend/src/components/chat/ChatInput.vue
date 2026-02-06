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

const selectedMode = ref('chat')

const handleSend = () => {
  if (!inputValue.value.trim() || props.disabled || props.loading) return
  emit('send', { text: inputValue.value, mode: selectedMode.value }) // Send object payload
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
  <!-- ... (rest of template) ... -->
</template>

<style scoped>
/* ... (existing styles) ... */

.mode-select {
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    padding: 0 8px;
    height: 40px;
    border-radius: var(--radius-md);
    font-size: 13px;
    cursor: pointer;
    outline: none;
    transition: all 0.2s;
    min-width: 110px;
}

.mode-select:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-text-muted);
}

.mode-select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

@media (max-width: 768px) {
  .input-area {
    padding: 12px 16px 20px;
  }
  
  .input-row {
    padding: 6px;
  }
  
  .mode-select {
    height: 36px;
    font-size: 12px;
    min-width: 90px;
  }

  .btn-attach, .btn-send {
    width: 36px;
    height: 36px;
  }
}
</style>
