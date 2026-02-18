<script setup>
import { useMarkdown } from '@/composables/useMarkdown'
import { ref, computed } from 'vue'
import api from '@/utils/api'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const props = defineProps({
  message: { type: Object, required: true },
  userInitial: { type: String, default: 'U' },
  userAvatarUrl: { type: String, default: '' },
  isStreaming: { type: Boolean, default: false },
  t: { type: Function, required: true }
})

const emit = defineEmits(['copy'])

const { render, copyToClipboard } = useMarkdown()
const copied = ref(false)
const viewingImage = ref(null)
const messageRef = ref(null)
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
  const rawEvents = props.message.agentEvents.filter(e =>
    ['thinking', 'tool_start', 'tool_complete'].includes(e.type)
  )
  const mergedEvents = []
  const thinkingByStep = {}
  const toolByStep = {}
  const maxStep = Math.max(...rawEvents.map(e => e.step || 0), 0)
  const isComplete = props.message.agentEvents.some(e =>
    e.type === 'agent_complete' || e.type === 'answer_done'
  )

  rawEvents.forEach(evt => {
    if (evt.type === 'thinking') {
      const step = evt.step
      const isPlaceholder = evt.message && evt.message.startsWith('กำลังวิเคราะห์...')
      if (thinkingByStep[step] !== undefined) {
        if (!isPlaceholder && evt.message?.trim()) {
          mergedEvents[thinkingByStep[step]] = { ...evt, isActive: false }
        }
      } else {
        if (!isPlaceholder && evt.message?.trim()) {
          mergedEvents.push({ ...evt, isActive: false })
          thinkingByStep[step] = mergedEvents.length - 1
        } else if (!isComplete && step === maxStep) {
          mergedEvents.push({ ...evt, isActive: true })
          thinkingByStep[step] = mergedEvents.length - 1
        }
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
  return mergedEvents
})

const showAgentFlow = computed(() =>
  props.isStreaming || (hasAgentEvents.value && timelineEvents.value.length > 0)
)

// Flow header summary text
const flowHeaderText = computed(() => {
  if (!agentSummary.value?.isComplete) return 'Working...'
  const parts = ['Thought']
  if (agentSummary.value.durationStr) parts.push(`for ${agentSummary.value.durationStr}`)
  if (agentSummary.value.steps) parts.push(`· ${agentSummary.value.steps} steps`)
  return parts.join(' ')
})

// Tool label mapping
const toolLabel = (name) => {
  const labels = {
    search: 'Searching knowledge base',
    calculator: 'Calculating',
    mcp: 'Querying university data'
  }
  return labels[name] || `Using ${name}`
}

const toolIcon = (name) => {
  const icons = { search: '🔍', calculator: '🧮', mcp: '🏫' }
  return icons[name] || '🔧'
}

const viewImage = (src) => { viewingImage.value = src }

const handleCopy = async () => {
  const success = await copyToClipboard(props.message.content)
  if (success) {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
    emit('copy', props.message.content)
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

const getFileEmoji = (att) => {
  if (!att.mimeType && !att.fileName) return '📎'
  const name = att.fileName || ''
  if (att.mimeType?.includes('pdf') || name.endsWith('.pdf')) return '📄'
  if (att.mimeType?.includes('sheet') || att.mimeType?.includes('excel') || name.match(/\.xlsx?$/)) return '📊'
  if (name.match(/\.docx?$/)) return '📝'
  return '📎'
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
            <img
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
            <img
              v-for="(att, i) in message.attachments.filter(a => a.mimeType?.startsWith('image/'))"
              :key="'img-' + i"
              :src="`/api/chat/attachment/${att.key}?token=${authStore.token}`"
              class="msg-image placeholder"
              loading="lazy"
              @click="viewImage(`/api/chat/attachment/${att.key}?token=${authStore.token}`)"
              @error="$event.target.style.display='none'"
              @load="$event.target.classList.remove('placeholder')"
            />
            <div
              v-for="(att, i) in message.attachments.filter(a => !a.mimeType?.startsWith('image/'))"
              :key="'file-' + i"
              class="file-chip clickable"
              @click="downloadAttachment(att)"
            >
              <span class="file-emoji">{{ getFileEmoji(att) }}</span>
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

                    <!-- Thinking icon -->
                    <div v-if="evt.type === 'thinking'" class="tl-dot thinking" :class="{ active: evt.isActive }">
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

                    <!-- Thinking -->
                    <template v-if="evt.type === 'thinking'">
                      <div class="tl-label thinking-label">
                        Thinking · Step {{ evt.step }}
                      </div>
                      <div v-if="evt.isActive" class="thinking-active">
                        <span class="dot-pulse" /><span class="dot-pulse" /><span class="dot-pulse" />
                        <span class="thinking-live" v-if="evt.message">{{ evt.message }}</span>
                      </div>
                      <div v-else class="thinking-text markdown-body" v-html="render(evt.message)" />
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
            v-if="message.content"
            v-html="render(message.content)"
          />

          <!-- Typing dots (fallback when no agent flow) -->
          <div v-if="!message.content && !showAgentFlow && isStreaming" class="typing-dots">
            <span /><span /><span />
          </div>

          <!-- Action Bar -->
          <div class="action-bar" v-if="message.content">
            <!-- Copy -->
            <button class="action-btn" @click="handleCopy" :class="{ copied }" :title="t('copy')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect v-if="!copied" x="9" y="9" width="13" height="13" rx="2"/>
                <path v-if="!copied" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                <polyline v-else points="20 6 9 17 4 12"/>
              </svg>
              <span>{{ copied ? 'Copied' : 'Copy' }}</span>
            </button>

            <!-- Metadata separator -->
            <template v-if="message.meta || agentSummary?.isComplete">
              <span class="action-sep" />

              <!-- Answer mode -->
              <span v-if="message.meta?.answer_mode" class="meta-chip">
                {{ message.meta.answer_mode === 'rag' ? 'RAG' :
                   message.meta.answer_mode === 'file_grounded' ? 'File' : 'Internal' }}
              </span>

              <!-- Confidence -->
              <span
                v-if="message.meta?.confidence"
                class="meta-chip confidence"
                :class="message.meta.confidence.toLowerCase()"
              >
                {{ message.meta.confidence }} confidence
              </span>

              <!-- Steps -->
              <span v-if="agentSummary?.steps" class="meta-chip">
                {{ agentSummary.steps }} steps
              </span>

              <!-- Duration -->
              <span v-if="agentSummary?.durationStr" class="meta-chip">
                {{ agentSummary.durationStr }}
              </span>
            </template>
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
.file-emoji { font-size: 18px; flex-shrink: 0; }
.file-info { display: flex; flex-direction: column; overflow: hidden; }
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
.tl-dot.thinking { background: #eff6ff; border-color: #bfdbfe; color: #3b82f6; }
.tl-dot.thinking.active { animation: pulse-ring 2s infinite; }
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
.thinking-label { color: #3b82f6; }
.tool-label { color: #f97316; }

/* Thinking content */
.thinking-active {
  display: flex; align-items: center; gap: 4px; padding: 4px 0;
}
.dot-pulse {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--color-text-muted);
  animation: bounce 1.4s infinite ease-in-out both;
}
.dot-pulse:nth-child(1) { animation-delay: -0.32s; }
.dot-pulse:nth-child(2) { animation-delay: -0.16s; }
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.5); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
.thinking-live {
  font-size: 12px; color: var(--color-text-muted);
  font-style: italic; margin-left: 4px;
}
.thinking-text {
  font-size: 13px; line-height: 1.6; color: var(--color-text-secondary);
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

.action-sep { width: 1px; height: 14px; background: var(--color-border); flex-shrink: 0; }

.meta-chip {
  font-size: 11px; color: var(--color-text-muted);
  padding: 2px 0; font-weight: 500;
}

.meta-chip.confidence.high { color: #16a34a; }
.meta-chip.confidence.medium { color: #d97706; }
.meta-chip.confidence.low { color: #dc2626; }

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