<script setup>
import { ref } from 'vue'
import { useMarkdown } from '@/composables/useMarkdown'

const props = defineProps({
  message: {
    type: Object,
    required: true
  },
  userInitial: {
    type: String,
    default: 'U'
  }
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
  const date = new Date(timestamp)
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="message-row" :class="message.role">
    <div class="message-container">
      <!-- Assistant Avatar -->
      <div class="message-avatar" v-if="message.role === 'assistant'">
        <div class="avatar-ring" :class="{ pulse: !message.content }">
          <span>🤖</span>
        </div>
      </div>
      
      <!-- Content -->
      <div class="message-bubble" :class="{ error: message.error }">
        <div 
          v-if="message.role === 'assistant'" 
          class="markdown-body"
          v-html="render(message.content)"
        ></div>
        <div v-else class="user-text">{{ message.content }}</div>
        
        <div class="message-footer">
          <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          <button 
            v-if="message.role === 'assistant' && message.content" 
            class="btn-copy"
            :class="{ copied }"
            @click="handleCopy"
            :title="copied ? 'Copied!' : 'Copy'"
          >
            <svg v-if="!copied" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- User Avatar -->
      <div class="message-avatar user-avatar" v-if="message.role === 'user'">
        <div class="avatar-gradient">{{ userInitial }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-row {
  margin-bottom: 24px;
}

.message-row.user {
  display: flex;
  justify-content: flex-end;
}

.message-container {
  display: flex;
  gap: 12px;
  max-width: 80%;
}

.message-row.user .message-container {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.avatar-ring {
  width: 40px;
  height: 40px;
  background: var(--glass-bg);
  border: 2px solid var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.avatar-ring.pulse {
  animation: ring-pulse 1.5s ease-in-out infinite;
}

@keyframes ring-pulse {
  0%, 100% { border-color: var(--color-primary); }
  50% { border-color: var(--color-accent); }
}

.avatar-gradient {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: white;
}

.message-bubble {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  padding: 16px;
  position: relative;
}

.message-row.user .message-bubble {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border: none;
}

.message-bubble.error {
  border-color: var(--color-error);
  background: rgba(239, 68, 68, 0.1);
}

.user-text {
  color: white;
  font-size: 15px;
  line-height: 1.6;
}

/* Markdown Styles */
.markdown-body {
  color: var(--color-text);
  font-size: 15px;
  line-height: 1.7;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
  color: var(--color-text);
}

.markdown-body :deep(p) {
  margin-bottom: 0.8em;
}

.markdown-body :deep(code) {
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 0.9em;
}

.markdown-body :deep(pre) {
  background: rgba(0, 0, 0, 0.4);
  padding: 16px;
  border-radius: 12px;
  overflow-x: auto;
  margin: 1em 0;
}

.markdown-body :deep(pre code) {
  padding: 0;
  background: none;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.markdown-body :deep(a) {
  color: var(--color-primary);
}

.message-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.message-time {
  font-size: 11px;
  color: var(--color-text-muted);
}

.message-row.user .message-time {
  color: rgba(255, 255, 255, 0.7);
}

.btn-copy {
  padding: 4px;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-copy:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.1);
}

.btn-copy.copied {
  color: var(--color-success);
}

.btn-copy svg {
  width: 14px;
  height: 14px;
}

@media (max-width: 768px) {
  .message-container {
    max-width: 95%;
  }
}
</style>
