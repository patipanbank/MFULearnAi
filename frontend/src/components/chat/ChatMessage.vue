<script setup>
import { useMarkdown } from '@/composables/useMarkdown'
import { ref } from 'vue'

const props = defineProps({
  message: { type: Object, required: true },
  userInitial: { type: String, default: 'U' },
  t: { type: Function, required: true }
})

const emit = defineEmits(['copy'])

const { render, copyToClipboard } = useMarkdown()
const copied = ref(false)

const handleCopy = async () => {
  const success = await copyToClipboard(props.message.content)
  if (success) {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
    emit('copy', props.message.content)
  }
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="message-wrapper" :class="message.role">
    <!-- USER: Bubble style -->
    <template v-if="message.role === 'user'">
      <div class="user-bubble-container">
        <div class="bubble user">
          <p>{{ message.content }}</p>
          <span class="time">{{ formatTime(message.timestamp) }}</span>
        </div>
        <div class="avatar-circle user">{{ userInitial }}</div>
      </div>
    </template>
    
    <!-- ASSISTANT: Canvas style (improved) -->
    <template v-else>
      <div class="assistant-canvas">
        <div class="avatar-circle assistant">🤖</div>
        
        <div class="content-col">
          <div class="assistant-header">
            <span class="name">{{ t('aiAssistant') }}</span>
            <span class="time">{{ formatTime(message.timestamp) }}</span>
          </div>
          
          <div class="prose-content" v-if="message.content" v-html="render(message.content)"></div>
          
          <!-- Typing Indicator (Embedded) -->
          <div v-else class="typing-indicator">
            <div class="dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span class="text">{{ t('thinking') }}</span>
          </div>
          
          <div class="actions" v-if="message.content">
            <button class="btn-copy" @click="handleCopy" :class="{ copied }">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect v-if="!copied" x="9" y="9" width="13" height="13" rx="2"/>
                <path v-if="!copied" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                <polyline v-else points="20 6 9 17 4 12"/>
              </svg>
              <span>{{ copied ? t('copied') : t('copy') }}</span>
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.message-wrapper {
  margin-bottom: 32px;
}

/* Common Avatar */
.avatar-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  font-weight: 600;
}

.avatar-circle.user {
  background: var(--color-accent);
  color: white;
}

.avatar-circle.assistant {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  font-size: 18px;
}

/* === USER STYLES === */
.user-bubble-container {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 12px;
  padding-left: 20%;
}

.bubble.user {
  background: var(--color-accent);
  color: white;
  padding: 12px 18px;
  border-radius: 18px;
  border-bottom-right-radius: 4px;
  position: relative;
  box-shadow: var(--shadow-md);
}

.bubble.user p {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.bubble.user .time {
  display: block;
  font-size: 11px;
  opacity: 0.8;
  margin-top: 6px;
  text-align: right;
  font-weight: 500;
}

/* === ASSISTANT STYLES === */
.assistant-canvas {
  display: flex;
  gap: 16px;
  padding-right: 5%;
}

.content-col {
  flex: 1;
  min-width: 0;
}

.assistant-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
}

.assistant-header .name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.assistant-header .time {
  font-size: 11px;
  color: var(--color-text-muted);
}

/* Improved Prose (Markdown) */
.prose-content {
  font-size: 15px;
  line-height: 1.75;
  color: var(--color-text-primary);
}

/* Typing Indicator (Embedded) */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.dots {
  display: flex;
  gap: 4px;
}

.dots span {
  width: 6px;
  height: 6px;
  background: var(--color-text-muted);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.dots span:nth-child(1) { animation-delay: -0.32s; }
.dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.typing-indicator .text {
  font-size: 13px;
  color: var(--color-text-muted);
}

.actions {
  margin-top: 12px;
}

.btn-copy {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-copy:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.btn-copy.copied {
  color: var(--color-success);
  border-color: var(--color-success);
}
</style>
