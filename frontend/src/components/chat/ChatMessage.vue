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
const flowManualToggle = ref(null)

const flowExpanded = computed(() => {
  if (flowManualToggle.value !== null) return flowManualToggle.value
  if (props.isStreaming && hasAgentEvents.value) return true
  return false
})

const toggleFlow = () => {
  flowManualToggle.value = flowManualToggle.value === null
    ? !flowExpanded.value
    : !flowManualToggle.value
}

const hasAgentEvents = computed(() =>
  props.message.agentEvents && props.message.agentEvents.length > 0
)

const agentSummary = computed(() => {
  if (!hasAgentEvents.value) return null
  const events = props.message.agentEvents
  const completeEvt = events.find(e => e.type === 'agent_complete')
  const totalSteps = completeEvt?.totalSteps || events.filter(e => e.type === 'agent_step').length
  const totalDuration = completeEvt?.durationMs
  const toolsUsed = [...new Set(events.filter(e => e.type === 'tool_complete').map(e => e.toolName))]
  return {
    steps: totalSteps,
    durationMs: totalDuration,
    durationStr: totalDuration ? (totalDuration / 1000).toFixed(1) + 's' : null,
    toolsUsed,
    isComplete: !!completeEvt
  }
})

const timelineEvents = computed(() => {
  if (!hasAgentEvents.value) return []
  // Filter only block and tool events. Legacy thinking events are ignored or mapped.
  let rawEvents = props.message.agentEvents.filter(e =>
    ['block', 'tool_start', 'tool_complete'].includes(e.type)
  )

  // Remove the very last event from the timeline if it's a text block, 
  // because that will become our main bubble text.
  if (rawEvents.length > 0) {
    const lastEvent = rawEvents[rawEvents.length - 1]
    if (lastEvent.type === 'block') {
      rawEvents = rawEvents.slice(0, -1)
    }
  }

  const mergedEvents = []
  const blockByStep = {}
  const toolByStep = {}
  const isComplete = props.message.agentEvents.some(e =>
    e.type === 'agent_complete'
  )

  rawEvents.forEach(evt => {
    if (evt.type === 'block') {
      const step = evt.step
      // A block replaces the legacy thinking bubble. It contains actual text.
      if (blockByStep[step] !== undefined) {
        mergedEvents[blockByStep[step]] = { ...evt, isActive: false }
      } else {
        mergedEvents.push({ ...evt, isActive: !evt.isFinished })
        blockByStep[step] = mergedEvents.length - 1
      }
    } else if (evt.type === 'tool_start') {
      mergedEvents.push({ ...evt, result: null, isToolComplete: false, success: false })
      if (evt.step) toolByStep[evt.step] = mergedEvents.length - 1
    } else if (evt.type === 'tool_complete') {
      if (evt.step && toolByStep[evt.step] !== undefined) {
        const idx = toolByStep[evt.step]
        const startEvt = mergedEvents[idx]
        if (startEvt.toolName === evt.toolName) {
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
      } else {
        mergedEvents.push(evt)
      }
    }
  })
  
  // Clean up empty blocks (blocks with no text) unless it's the only one and active
  return mergedEvents.filter(e => e.type !== 'block' || e.content?.trim() || e.isActive)
})

const mainBubbleText = computed(() => {
  if (props.message.content) return props.message.content;
  if (!hasAgentEvents.value) return '';
  
  const rawEvents = props.message.agentEvents.filter(e =>
    ['block', 'tool_start', 'tool_complete'].includes(e.type)
  );
  if (rawEvents.length === 0) return '';
  
  const lastEvent = rawEvents[rawEvents.length - 1];
  if (lastEvent.type === 'block') {
    return lastEvent.content || '';
  }
  return '';
})

const showAgentFlow = computed(() =>
  props.isStreaming || (hasAgentEvents.value && timelineEvents.value.length > 0)
)

// Flow header summary text — shows "agent process for Xs"
const flowHeaderText = computed(() => {
  if (!agentSummary.value?.isComplete) return 'Working...'
  const sec = agentSummary.value.durationStr || ''
  return sec ? `Process took ${sec}` : 'Process complete'
})

// Tool label mapping
const toolLabel = (name) => {
  const labels = {
    search: 'Searching knowledge base',
    check_policy: 'ตรวจสอบนโยบาย',
    calculator: 'Calculating',
    mcp: 'Querying university data'
  }
  return labels[name] || `Using ${name}`
}

const toolIcon = (name) => {
  const icons = { search: '🔍', check_policy: '📋', calculator: '🧮', mcp: '🏫' }
  return icons[name] || '🔧'
}

const viewImage = (src) => { viewingImage.value = src }

const handleCopy = async () => {
  const success = await copyToClipboard(mainBubbleText.value || props.message.content)
  if (success) {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
    emit('copy', mainBubbleText.value || props.message.content)
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
  if (att.key) {
    try {
      const response = await api.get(`/chat/attachment/${att.key}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: response.headers['content-type'] }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', att.fileName || 'download')
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed', error)
    }
  } else if (att.url) {
    window.open(att.url, '_blank')
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
              @click="viewImage(`data:${img.mediaType};base64,${img.data}`)"
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
              :src="`/api/chat/attachment/${att.key}?token=${authStore.token}`"
              class="msg-image"
              @click="viewImage(`/api/chat/attachment/${att.key}?token=${authStore.token}`)"
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

          <!-- Agent Flow -->
          <div v-if="showAgentFlow" class="agent-flow">
            <!-- Toggle Header -->
            <div class="flow-toggle" @click="toggleFlow" role="button" tabindex="0">
              <svg
                class="toggle-chevron"
                :class="{ expanded: flowExpanded }"
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2.5"
              >
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <span class="flow-toggle-label">{{ flowHeaderText }}</span>
            </div>

            <!-- Timeline -->
            <div v-if="flowExpanded" class="flow-body">
              <TransitionGroup name="flow" tag="div">
                <div
                  v-for="(evt, idx) in timelineEvents"
                  :key="evt.id || idx"
                  class="tl-item"
                >
                  <!-- Spine -->
                  <div class="tl-spine">
                    <div class="tl-line" />

                    <!-- Block icon -->
                    <div v-if="evt.type === 'block'" class="tl-dot block" :class="{ active: evt.isActive }">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>

                    <!-- Tool icon -->
                    <div v-else-if="evt.type === 'tool_start'" class="tl-dot tool">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                      </svg>
                    </div>

                    <div v-else class="tl-dot" />
                  </div>

                  <!-- Content -->
                  <div class="tl-content">

                    <!-- Text Block -->
                    <template v-if="evt.type === 'block'">
                      <div class="tl-label block-label">
                        Phase {{ evt.step || 1 }}
                      </div>
                      <div class="block-text markdown-body" v-html="render(evt.content || '')" />
                      <div v-if="evt.isActive" class="block-active">
                        <span class="dot-pulse" /><span class="dot-pulse" /><span class="dot-pulse" />
                      </div>
                    </template>

                    <!-- Tool -->
                    <template v-else-if="evt.type === 'tool_start'">
                      <div class="tl-label tool-label">
                        {{ toolIcon(evt.toolName) }} {{ toolLabel(evt.toolName) }}
                      </div>
                      <div v-if="evt.input?.query" class="tool-query">"{{ evt.input.query }}"</div>
                      <div v-if="evt.isToolComplete" class="tool-result">
                        <span class="result-status" :class="evt.success ? 'ok' : 'err'">
                          {{ evt.success ? '✓' : '✗' }}
                          {{ evt.success ? 'Success' : 'Failed' }}
                        </span>
                        <span v-if="evt.durationMs" class="result-meta">· {{ evt.durationMs }}ms</span>
                      </div>
                    </template>

                  </div>
                </div>

                <!-- Live pulse -->
                <div v-if="!agentSummary?.isComplete && isStreaming" key="pulse" class="tl-item">
                  <div class="tl-spine">
                    <div class="tl-dot pulsing" />
                  </div>
                  <div class="tl-content">
                    <span class="processing-text">Processing...</span>
                  </div>
                </div>
              </TransitionGroup>
            </div>
          </div>

          <!-- Answer -->
          <div
            ref="messageRef"
            class="prose markdown-body"
            v-if="mainBubbleText"
            v-html="render(mainBubbleText)"
          />

          <!-- Typing dots (fallback when no agent flow) -->
          <div v-if="!mainBubbleText && !showAgentFlow && isStreaming" class="typing-dots">
            <span /><span /><span />
          </div>

          <!-- Action Bar: Copy | Like | Dislike -->
          <div class="action-bar" v-if="mainBubbleText">
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
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  padding: 10px 16px;
  border-radius: 18px; border-bottom-right-radius: 4px;
  box-shadow: var(--shadow-sm);
}
.bubble p { margin: 0; font-size: 15px; line-height: 1.65; white-space: pre-wrap; }
.muted-text { color: var(--color-text-muted); font-style: italic; font-size: 13px; }

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

/* ── Agent Flow ── */
.agent-flow {
  margin-bottom: 12px;
  border-left: 2px solid var(--color-border);
  padding-left: 12px;
}

.flow-toggle {
  display: flex; align-items: center; gap: 6px;
  cursor: pointer; padding: 2px 0; user-select: none;
  color: var(--color-text-muted);
  transition: color 0.15s;
}
.flow-toggle:hover { color: var(--color-text-primary); }

.toggle-chevron {
  transition: transform 0.2s ease;
  transform: rotate(0deg);
  flex-shrink: 0;
}
.toggle-chevron.expanded { transform: rotate(90deg); }

.flow-toggle-label { font-size: 13px; font-weight: 500; }

.flow-body { margin-top: 12px; display: flex; flex-direction: column; }

/* Timeline */
.tl-item {
  display: flex; gap: 12px;
  padding-bottom: 16px;
  position: relative;
}

.tl-spine {
  display: flex; flex-direction: column; align-items: center;
  width: 20px; flex-shrink: 0; padding-top: 2px;
  position: relative;
}

.tl-line {
  position: absolute; top: 22px; bottom: -10px;
  width: 1px; background: var(--color-border); opacity: 0.5;
}
.tl-item:last-child .tl-line { display: none; }

.tl-dot {
  width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--color-bg-secondary); border: 1px solid var(--color-border);
  color: var(--color-text-muted); z-index: 1;
}
.tl-dot.block { background: #eff6ff; border-color: #bfdbfe; color: #3b82f6; }
.tl-dot.block.active { animation: pulse-ring 2s infinite; }
.tl-dot.tool { background: #fff7ed; border-color: #fed7aa; color: #f97316; }
.tl-dot.pulsing { background: var(--color-bg-tertiary); animation: pulse-ring 1.5s infinite; }

@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 30%, transparent); }
  70% { box-shadow: 0 0 0 5px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}

.tl-content { flex: 1; min-width: 0; padding-top: 1px; }

.tl-label {
  font-size: 12px; font-weight: 600; margin-bottom: 4px;
  text-transform: uppercase; letter-spacing: 0.4px;
}
.block-label { color: #3b82f6; }
.tool-label { color: #f97316; }

/* Block content */
.block-text {
  font-size: 14px; line-height: 1.6; color: var(--color-text-primary);
  /* Strip markdown bottom padding inside timeline */
  margin-bottom: 0 !important;
}
.block-text :deep(p:last-child) { margin-bottom: 0; }
.block-active {
  display: flex; align-items: center; gap: 4px; padding: 4px 0; margin-top: 4px;
}

/* Tool content */
.tool-query {
  font-size: 13px; color: var(--color-text-secondary);
  font-style: italic; margin-bottom: 6px;
}
.tool-result { display: flex; align-items: center; gap: 6px; }
.result-status { font-size: 12px; font-weight: 600; }
.result-status.ok { color: #16a34a; }
.result-status.err { color: #dc2626; }
.result-meta { font-size: 11px; color: var(--color-text-muted); }

/* Processing */
.processing-text { font-size: 12px; color: var(--color-text-muted); font-style: italic; }

/* Flow transitions */
.flow-enter-active { transition: all 0.25s ease; }
.flow-enter-from { opacity: 0; transform: translateY(8px); }

/* ── Answer ── */
.prose { font-size: 15px; line-height: 1.75; color: var(--color-text-primary); }

/* Typing fallback */
.typing-dots { display: flex; gap: 4px; padding: 8px 0; }
.typing-dots span {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-text-muted);
  animation: bounce 1.4s infinite ease-in-out both;
}
.typing-dots span:nth-child(1) { animation-delay: -0.32s; }
.typing-dots span:nth-child(2) { animation-delay: -0.16s; }

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