<script setup>
import { useMarkdown } from '@/composables/useMarkdown'
import { ref, computed } from 'vue'
import api from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import LazyImage from '@/components/common/LazyImage.vue'

import { FileText, FileSpreadsheet, FileImage, File } from 'lucide-vue-next'

const authStore = useAuthStore()

const props = defineProps({
  message: { type: Object, required: true },
  userInitial: { type: String, default: 'U' },
  userAvatarUrl: { type: String, default: '' },
  isStreaming: { type: Boolean, default: false },
  t: { type: Function, required: true }
})

const emit = defineEmits(['copy', 'feedback'])

const { render, copyToClipboard } = useMarkdown()
const copied = ref(false)
const viewingImage = ref(null)
const messageRef = ref(null)

// Feedback state
const feedbackState = ref(null) // null | 'liked' | 'disliked'

const hasAgentEvents = computed(() =>
  props.message.agentEvents && props.message.agentEvents.length > 0
)

const timelineEvents = computed(() => {
  if (!hasAgentEvents.value) return []
  
  const rawEvents = props.message.agentEvents.filter(e =>
    ['block', 'tool_start', 'tool_complete'].includes(e.type)
  )

  const mergedEvents = []
  const blockByStep = {}
  const toolByStep = {}

  rawEvents.forEach(evt => {
    // Unique key to prevent collisions: step index + tool name (if tool)
    const stepKey = evt.step || 0
    
    if (evt.type === 'block') {
      if (blockByStep[stepKey] !== undefined) {
        mergedEvents[blockByStep[stepKey]] = { ...evt, isActive: false }
      } else {
        mergedEvents.push({ ...evt, isActive: !evt.isFinished })
        blockByStep[stepKey] = mergedEvents.length - 1
      }
    } else if (evt.type === 'tool_start') {
      const toolKey = `${stepKey}-${evt.toolName}`
      mergedEvents.push({ ...evt, result: null, isToolComplete: false, success: false })
      toolByStep[toolKey] = mergedEvents.length - 1
    } else if (evt.type === 'tool_complete') {
      const toolKey = `${stepKey}-${evt.toolName}`
      if (toolByStep[toolKey] !== undefined) {
        const idx = toolByStep[toolKey]
        const startEvt = mergedEvents[idx]
        mergedEvents[idx] = {
          ...startEvt,
          result: evt.resultPreview || evt.result || 'Completed',
          resultCount: evt.resultCount,
          durationMs: evt.durationMs,
          isToolComplete: true,
          success: evt.success
        }
      } else {
        mergedEvents.push(evt)
      }
    }
  })
  
  // Clean up and Apply streaming guard (fix "sticky" dots)
  return mergedEvents
    .filter(e => e.type !== 'block' || e.content?.trim() || e.isActive)
    .map(e => props.isStreaming ? e : { ...e, isActive: false })
})

// Tool label mapping
const toolLabel = (name) => {
  const labels = {
    search: props.t('tool.search'),
    check_policy: props.t('tool.checkPolicy'),
    calculator: props.t('tool.calculator'),
    mcp: props.t('tool.mcp')
  }
  if (labels[name]) return labels[name]
  // Format unknown/MCP tool names: snake_case → Title Case
  return name.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const toolIcon = (name) => {
  const icons = { search: '🔍', check_policy: '📋', calculator: '🧮', mcp: '🏫' }
  return icons[name] || '🔧'
}

const toolStatusLabel = (evt) => {
  if (!evt.isToolComplete) return ''
  return evt.success ? props.t('tool.done') : props.t('tool.failed')
}

const viewImage = (src) => { viewingImage.value = src }

const handleCopy = async () => {
  const contentToCopy = props.message.content || timelineEvents.value.filter(e => e.type === 'block').map(e => e.content).join('\n')
  const success = await copyToClipboard(contentToCopy)
  if (success) {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
    emit('copy', contentToCopy)
  }
}

const handleFeedback = (type) => {
  // Toggle: clicking same button again removes feedback
  if (feedbackState.value === type) {
    feedbackState.value = null
    emit('feedback', { messageId: props.message.id, type: null })
  } else {
    feedbackState.value = type
    emit('feedback', { messageId: props.message.id, type })
  }
}

const downloadAttachment = async (att) => {
  if (!att.key) {
    if (att.url) window.open(att.url, '_blank')
    return
  }

  let url = null
  try {
    const response = await api.get(`/chat/attachment/${att.key}`, { responseType: 'blob' })
    url = window.URL.createObjectURL(new Blob([response.data], { type: response.headers['content-type'] }))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', att.fileName || 'download')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Download failed', error)
  } finally {
    if (url) window.URL.revokeObjectURL(url)
  }
}

const formatBytes = (bytes) => {
  if (!bytes) return ''
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const getFileIcon = (file) => {
  // Try to determine by mimeType or extension
  const name = file.fileName || file.name || ''
  const ext = name.split('.').pop()?.toLowerCase()
  
  if (file.mimeType?.startsWith('image/') || ['jpg','jpeg','png','gif','webp'].includes(ext)) {
      return { component: FileImage, color: '#10b981' }
  }

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
</script>

<template>
  <div class="message-wrapper" :class="message.role">

    <!-- ══ USER MESSAGE ══ -->
    <template v-if="message.role === 'user'">
      <div class="user-row">
        <div class="content-stack">

          <!-- Images -->
          <div v-if="message.images?.length" class="media-row">
            <LazyImage
              v-for="(img, i) in message.images" :key="i"
              :src="`data:${img.mediaType};base64,${img.data}`"
              class="msg-image"
              @click="viewImage"
            />
          </div>

          <!-- Files (uploading) -->
          <div v-if="message.files?.length" class="files-row">
            <div v-for="(file, i) in message.files" :key="i" class="file-chip">
              <span class="file-emoji">📄</span>
              <div class="file-info">
                <span class="file-name">{{ file.name }}</span>
                <div v-if="message.fileProgress?.currentFile === file.name" class="progress-track">
                  <div class="progress-fill" :style="{ width: message.fileProgress.percent + '%' }" />
                </div>
                <span v-else class="file-sub">Uploading...</span>
              </div>
            </div>
          </div>

          <!-- Persisted attachments -->
          <div v-if="message.attachments?.length" class="files-row">
            <LazyImage
              v-for="(att, i) in message.attachments.filter(a => a.mimeType?.startsWith('image/'))"
              :key="'img-' + i"
              :src="`/api/chat/attachment/${att.key}`"
              :secure="true"
              class="msg-image"
              @click="viewImage"
            />
            <div
              v-for="(att, i) in message.attachments.filter(a => !a.mimeType?.startsWith('image/'))"
              :key="'file-' + i"
              class="file-chip clickable"
              @click="downloadAttachment(att)"
            >
              <div class="chip-icon">
                <component
                  :is="getFileIcon(att).component"
                  :color="getFileIcon(att).color"
                  :size="24"
                />
              </div>
              <div class="file-info">
                <span class="file-name">{{ att.fileName }}</span>
                <span class="file-sub">{{ formatBytes(att.fileSize) }}</span>
              </div>
            </div>
          </div>

          <!-- Bubble -->
          <div class="bubble">
            <p v-if="message.content">{{ message.content }}</p>
            <p v-else class="muted-text">Sent a file</p>
          </div>

          <!-- Copy -->
          <div class="user-actions">
            <button class="action-btn fade-in-hover" @click="handleCopy" :class="{ copied }">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect v-if="!copied" x="9" y="9" width="13" height="13" rx="2"/>
                <path v-if="!copied" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                <polyline v-else points="20 6 9 17 4 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Avatar -->
        <div class="avatar user">
          <img v-if="userAvatarUrl" :src="userAvatarUrl" class="avatar-img" referrerpolicy="no-referrer" />
          <span v-else>{{ userInitial }}</span>
        </div>
      </div>

      <!-- Lightbox -->
      <Teleport to="body">
        <div v-if="viewingImage" class="lightbox" @click="viewingImage = null">
          <button class="lightbox-close">&times;</button>
          <img :src="viewingImage" class="lightbox-img" @click.stop />
        </div>
      </Teleport>
    </template>

    <!-- ══ ASSISTANT MESSAGE ══ -->
    <template v-else>
      <div class="assistant-row">
        <div class="avatar assistant">
          <img src="@/assets/dindin-ai.png" alt="AI" class="avatar-img" />
        </div>

        <div class="content-col">
          <!-- Name -->
          <div class="assistant-name">{{ t('aiAssistant') }}</div>

          <!-- Linear Stream / Standard Message -->
          <div class="message-body">
            
            <!-- Standard Message Fallback (No Timeline Events OR blocks have no content from old MongoDB data) -->
            <template v-if="(timelineEvents.length === 0 || !timelineEvents.some(e => e.type === 'block' && e.content?.trim())) && message.content">
              <div ref="messageRef" class="prose markdown-body" v-html="render(message.content)" />
              <!-- Show tool badges from old data below the content -->
              <div v-if="timelineEvents.length > 0" class="linear-stream" style="margin-top: 0.5rem;">
                <template v-for="(evt, idx) in timelineEvents.filter(e => e.type !== 'block')" :key="evt.id || idx">
                  <div v-if="evt.type === 'tool_start'" 
                       class="tool-badge" 
                       :class="{ 'tool-active': !evt.isToolComplete, 'tool-done': evt.isToolComplete && evt.success, 'tool-error': evt.isToolComplete && !evt.success }">
                    <div class="tool-badge-header">
                      <span class="tool-icon-wrap">
                        <span class="tool-icon">{{ toolIcon(evt.toolName) }}</span>
                      </span>
                      <span class="tool-name">{{ toolLabel(evt.toolName) }}</span>
                      <span v-if="evt.isToolComplete" class="tool-status" :class="evt.success ? 'ok' : 'err'">
                        <span class="status-icon">{{ evt.success ? '✓' : '✗' }}</span>
                        <span class="status-text">{{ toolStatusLabel(evt) }}</span>
                      </span>
                      <span v-if="evt.durationMs" class="tool-meta">{{ evt.durationMs }}ms</span>
                    </div>
                    <div v-if="evt.input?.query" class="tool-query">"{{ evt.input.query }}"</div>
                  </div>
                </template>
              </div>
            </template>
            
            <!-- Linear Block Stream -->
            <template v-else>
              <div class="linear-stream" ref="messageRef">
                <template v-for="(evt, idx) in timelineEvents" :key="evt.id || idx">
                  
                  <!-- Text Block -->
                  <div v-if="evt.type === 'block'" class="stream-block">
                    <div class="prose markdown-body" v-html="render(evt.content || '')" />
                    <div v-if="evt.isActive" class="typing-dots inline-dots">
                      <span /><span /><span />
                    </div>
                  </div>
                  
                  <!-- Tool Badge -->
                  <div v-else-if="evt.type === 'tool_start'" 
                       class="tool-badge" 
                       :class="{ 'tool-active': !evt.isToolComplete, 'tool-done': evt.isToolComplete && evt.success, 'tool-error': evt.isToolComplete && !evt.success }">
                    <div class="tool-badge-header">
                      <span class="tool-icon-wrap">
                        <span class="tool-icon">{{ toolIcon(evt.toolName) }}</span>
                        <span v-if="!evt.isToolComplete" class="tool-icon-ring" />
                      </span>
                      <span class="tool-name">{{ toolLabel(evt.toolName) }}</span>
                      
                      <!-- Status -->
                      <transition name="tool-status-fade">
                        <span v-if="evt.isToolComplete" class="tool-status" :class="evt.success ? 'ok' : 'err'">
                          <span class="status-icon">{{ evt.success ? '✓' : '✗' }}</span>
                          <span class="status-text">{{ toolStatusLabel(evt) }}</span>
                        </span>
                        <div v-else class="tool-status active">
                          <span class="dot-pulse"/><span class="dot-pulse"/><span class="dot-pulse"/>
                        </div>
                      </transition>

                      <!-- Duration -->
                      <span v-if="evt.durationMs" class="tool-meta">{{ evt.durationMs }}ms</span>
                    </div>
                    <div v-if="evt.input?.query" class="tool-query">"{{ evt.input.query }}"</div>
                  </div>
                  
                </template>
              </div>
            </template>

            <!-- Typing dots (fallback when empty and streaming) -->
            <div v-if="timelineEvents.length === 0 && !message.content && isStreaming" class="typing-dots">
              <span /><span /><span />
            </div>

          </div>

          <!-- Action Bar: Copy | Like | Dislike -->
          <div class="action-bar" v-if="message.content || hasAgentEvents">
            <!-- Copy -->
            <button class="action-btn" @click="handleCopy" :class="{ copied }" :title="t('copy')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect v-if="!copied" x="9" y="9" width="13" height="13" rx="2"/>
                <path v-if="!copied" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                <polyline v-else points="20 6 9 17 4 12"/>
              </svg>
              <span>{{ copied ? 'Copied' : 'Copy' }}</span>
            </button>

            <!-- Like -->
            <button
              class="action-btn feedback-btn"
              :class="{ active: feedbackState === 'liked' }"
              @click="handleFeedback('liked')"
              title="Like"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
              </svg>
            </button>

            <!-- Dislike -->
            <button
              class="action-btn feedback-btn"
              :class="{ active: feedbackState === 'disliked' }"
              @click="handleFeedback('disliked')"
              title="Dislike"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
                <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
              </svg>
            </button>
          </div>

        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ── Base ── */
.message-wrapper { margin-bottom: 28px; }

.avatar {
  width: 34px; height: 34px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 600;
  flex-shrink: 0; overflow: hidden;
}
.avatar.user { background: var(--color-user-gradient, #6366f1); color: white; }
.avatar.assistant { background: var(--color-bg-secondary); border: 1px solid var(--color-border); }
.avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

/* ── User ── */
.user-row {
  display: flex; justify-content: flex-end; gap: 10px;
}

.content-stack {
  display: flex; flex-direction: column; align-items: flex-end;
  gap: 4px;
  max-width: min(78%, 600px);
}

.bubble {
  padding: 10px 16px;
  border-radius: 18px;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.user .bubble {
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-bottom-right-radius: 4px;
}

.assistant .bubble {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-bottom-left-radius: 4px;
}

.bubble p { 
  margin: 0; 
  font-size: 15px; 
  line-height: 1.65; 
  white-space: pre-wrap; 
}

.user .bubble p {
  color: #ffffff; /* Guaranteed readability on accent background */
}

.assistant .bubble p {
  color: var(--color-text-primary);
}

.muted-text { 
  color: var(--color-text-muted); 
  font-style: italic; 
  font-size: 13px; 
}

.user .muted-text {
  color: rgba(255, 255, 255, 0.8);
}

/* Media */
.media-row {
  display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end;
}
.msg-image {
  max-width: 180px; max-height: 180px;
  border-radius: 10px; object-fit: cover;
  border: 1px solid var(--color-border);
  cursor: zoom-in; transition: transform 0.15s, opacity 0.2s;
}
.msg-image.placeholder {
  background-color: var(--color-bg-tertiary);
  min-width: 100px; min-height: 100px;
  opacity: 0.5;
}
.msg-image:hover { transform: scale(1.02); }

/* File chips */
.files-row { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
.file-chip {
  display: flex; align-items: center; gap: 8px;
  background: var(--color-bg-secondary); border: 1px solid var(--color-border);
  border-radius: 10px; padding: 6px 10px; max-width: 220px;
}
.file-chip.clickable { cursor: pointer; transition: background 0.15s; }
.file-chip.clickable:hover { background: var(--color-bg-tertiary); }
.chip-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--color-bg-tertiary);
  border-radius: 8px;
}
.file-info { display: flex; flex-direction: column; overflow: hidden; gap: 2px; }
.file-name { font-size: 12px; font-weight: 500; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-sub { font-size: 11px; color: var(--color-text-muted); }
.progress-track { height: 3px; background: var(--color-border); border-radius: 2px; margin-top: 4px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--color-accent); border-radius: 2px; transition: width 0.3s; }

/* User actions */
.user-actions { height: 22px; display: flex; align-items: center; }
.fade-in-hover { opacity: 0; transition: opacity 0.2s; }
.user-row:hover .fade-in-hover { opacity: 1; }

/* ── Assistant ── */
.assistant-row { display: flex; gap: 14px; padding-right: 4%; }
.content-col { flex: 1; min-width: 0; }
.assistant-name {
  font-size: 13px; font-weight: 600;
  color: var(--color-text-primary); margin-bottom: 8px;
}

/* ── Inline Linear Stream ── */
.linear-stream {
  display: flex;
  flex-direction: column;
  gap: 16px;
}


/* Tool Badge */
.tool-badge {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 10px 14px;
  margin: 4px 0;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  animation: tool-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  transition: border-color 0.4s ease, box-shadow 0.4s ease, background 0.4s ease;
}

.tool-badge.tool-active {
  border-color: color-mix(in srgb, var(--color-accent, #6366f1) 40%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent, #6366f1) 10%, transparent),
              0 2px 8px color-mix(in srgb, var(--color-accent, #6366f1) 8%, transparent);
}

.tool-badge.tool-done {
  border-color: color-mix(in srgb, #16a34a 25%, var(--color-border));
}

.tool-badge.tool-error {
  border-color: color-mix(in srgb, #dc2626 25%, var(--color-border));
}

@keyframes tool-slide-in {
  0% {
    opacity: 0;
    transform: translateY(6px) scale(0.97);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.tool-badge-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.tool-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
}

.tool-icon {
  font-size: 14px;
  position: relative;
  z-index: 1;
}

.tool-icon-ring {
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: 1.5px solid color-mix(in srgb, var(--color-accent, #6366f1) 50%, transparent);
  animation: ring-pulse 2s ease-in-out infinite;
}

@keyframes ring-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.15); }
}

.tool-name {
  flex: 1;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.tool-active .tool-name {
  color: var(--color-accent, #6366f1);
}

.tool-status {
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tool-status.ok {
  color: #16a34a;
}

.tool-status.ok .status-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: color-mix(in srgb, #16a34a 12%, transparent);
  font-size: 10px;
  animation: status-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.tool-status.err {
  color: #dc2626;
}

.tool-status.err .status-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: color-mix(in srgb, #dc2626 12%, transparent);
  font-size: 10px;
  animation: status-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.status-text {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.85;
}

@keyframes status-pop {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

/* Status transition */
.tool-status-fade-enter-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.tool-status-fade-leave-active { transition: opacity 0.15s ease; position: absolute; }
.tool-status-fade-enter-from { opacity: 0; transform: scale(0.8); }
.tool-status-fade-leave-to { opacity: 0; }

.tool-status.active { display: flex; align-items: center; gap: 3px; }

.tool-meta {
  font-size: 11px;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  opacity: 0;
  animation: fade-in-meta 0.3s ease 0.15s forwards;
}

@keyframes fade-in-meta {
  to { opacity: 1; }
}

.tool-query {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-style: italic;
  margin-top: 2px;
  margin-left: 30px; /* align with text ignoring icon */
  opacity: 0.85;
}

.inline-dots {
  padding: 6px 0;
}

/* Processing */
.processing-text { font-size: 12px; color: var(--color-text-muted); font-style: italic; }

/* ── Answer ── */
.prose { font-size: 15px; line-height: 1.75; color: var(--color-text-primary); }

/* Typing fallback */
.typing-dots { display: flex; gap: 5px; padding: 8px 0; align-items: center; }
.typing-dots span {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-text-muted);
  animation: typing-wave 1.4s ease-in-out infinite;
}
.typing-dots span:nth-child(1) { animation-delay: 0s; }
.typing-dots span:nth-child(2) { animation-delay: 0.15s; }
.typing-dots span:nth-child(3) { animation-delay: 0.3s; }

/* Tool active indicator */
.dot-pulse {
  display: inline-block;
  width: 4px; height: 4px; border-radius: 50%;
  background: var(--color-accent, #6366f1);
  animation: typing-wave 1.2s ease-in-out infinite;
}
.dot-pulse:nth-child(1) { animation-delay: 0s; }
.dot-pulse:nth-child(2) { animation-delay: 0.12s; margin-left: 3px; }
.dot-pulse:nth-child(3) { animation-delay: 0.24s; margin-left: 3px; }

@keyframes typing-wave {
  0%, 100% {
    transform: translateY(0);
    opacity: 0.3;
  }
  50% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

/* ── Action Bar ── */
.action-bar {
  display: flex; align-items: center; flex-wrap: wrap;
  gap: 6px; margin-top: 10px;
}

.action-btn {
  display: flex; align-items: center; gap: 5px;
  background: transparent; border: none;
  color: var(--color-text-muted); cursor: pointer;
  font-size: 12px; padding: 3px 6px; border-radius: 5px;
  transition: background 0.15s, color 0.15s;
}
.action-btn:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
.action-btn.copied { color: var(--color-success, #16a34a); }

/* Feedback buttons */
.feedback-btn.active { color: var(--color-accent, #6366f1); }
.feedback-btn.active svg { fill: currentColor; }

/* ── Lightbox ── */
.lightbox {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.88);
  display: flex; align-items: center; justify-content: center;
  animation: fadeIn 0.2s ease;
}
.lightbox-img {
  max-width: 90vw; max-height: 90vh;
  border-radius: 8px; box-shadow: 0 8px 40px rgba(0,0,0,0.5);
  animation: zoomIn 0.2s ease;
}
.lightbox-close {
  position: absolute; top: 20px; right: 20px;
  background: rgba(255,255,255,0.15); border: none;
  color: white; font-size: 28px; width: 40px; height: 40px;
  border-radius: 50%; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.lightbox-close:hover { background: rgba(255,255,255,0.3); }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes zoomIn { from { transform: scale(0.92); } to { transform: scale(1); } }

/* ── Responsive ── */
@media (max-width: 768px) {
  .content-stack { max-width: 88%; }
  .assistant-row { gap: 10px; padding-right: 0; }
  .avatar { width: 30px; height: 30px; }
  .prose { font-size: 14px; }
}
</style>