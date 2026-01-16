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
  <div class="message" :class="message.role">
    <!-- USER MESSAGE: Bubble style, right aligned -->
    <template v-if="message.role === 'user'">
      <div class="user-message">
        <div class="bubble">
          <p>{{ message.content }}</p>
          <span class="time">{{ formatTime(message.timestamp) }}</span>
        </div>
        <div class="avatar user">{{ userInitial }}</div>
      </div>
    </template>
    
    <!-- ASSISTANT MESSAGE: Canvas style, full width -->
    <template v-else>
      <div class="assistant-message">
        <div class="assistant-header">
          <div class="avatar assistant">🤖</div>
          <span class="name">AI Assistant</span>
          <span class="time">{{ formatTime(message.timestamp) }}</span>
        </div>
        
        <div class="canvas">
          <div class="prose" v-html="render(message.content)"></div>
        </div>
        
        <div class="actions" v-if="message.content">
          <button class="btn-action" @click="handleCopy" :class="{ copied }">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect v-if="!copied" x="9" y="9" width="13" height="13" rx="2"/>
              <path v-if="!copied" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              <polyline v-else points="20 6 9 17 4 12"/>
            </svg>
            <span>{{ copied ? t('copied') : t('copy') }}</span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.message {
  margin-bottom: 24px;
}

/* === USER MESSAGE === */
.user-message {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  justify-content: flex-end;
  padding-left: 60px;
}

.bubble {
  background: var(--color-accent);
  color: white;
  padding: 12px 16px;
  border-radius: var(--radius-lg);
  border-bottom-right-radius: 4px;
  max-width: 400px;
}

.bubble p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.bubble .time {
  display: block;
  font-size: 10px;
  opacity: 0.7;
  margin-top: 4px;
  text-align: right;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.avatar.user {
  background: var(--color-accent);
  color: white;
  font-weight: 600;
}

/* === ASSISTANT MESSAGE (Canvas Style) === */
.assistant-message {
  padding-right: 60px;
}

.assistant-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.avatar.assistant {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  font-size: 16px;
}

.assistant-header .name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.assistant-header .time {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-left: auto;
}

.canvas {
  background: transparent;
  padding: 0;
  padding-left: 40px;
}

.canvas .prose {
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-text-primary);
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  padding-left: 40px;
}

.btn-action {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-action:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.btn-action.copied {
  color: var(--color-success);
  border-color: var(--color-success);
}

/* Responsive */
@media (max-width: 768px) {
  .user-message {
    padding-left: 20px;
  }
  
  .assistant-message {
    padding-right: 20px;
  }
  
  .canvas {
    padding-left: 0;
  }
  
  .actions {
    padding-left: 0;
  }
}
</style>
