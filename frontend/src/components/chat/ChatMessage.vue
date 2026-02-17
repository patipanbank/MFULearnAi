<script setup>
import { useMarkdown } from '@/composables/useMarkdown'
import { ref, computed } from 'vue'
import api from '@/utils/api'

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
const flowManualToggle = ref(null) // null = auto, true/false = user override

// Auto-expand during streaming, collapse when done. User can override.
const flowExpanded = computed(() => {
    if (flowManualToggle.value !== null) return flowManualToggle.value
    // Auto-expand while streaming, auto-collapse when agent_complete received
    if (props.isStreaming && hasAgentEvents.value) return true
    return false
})

const toggleFlow = () => {
    flowManualToggle.value = flowManualToggle.value === null ? !flowExpanded.value : !flowManualToggle.value
}

// ── Agent Flow Timeline computeds ──
const hasAgentEvents = computed(() => {
    return props.message.agentEvents && props.message.agentEvents.length > 0
})

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
    // Filter to display-worthy events only
    return props.message.agentEvents.filter(e =>
        ['context_loaded', 'agent_step', 'thinking', 'tool_start', 'tool_complete',
         'answer_start', 'answer_done', 'agent_complete', 'step_usage'].includes(e.type)
    )
})

const eventIcon = (type) => {
    const icons = {
        context_loaded: '📝',
        agent_step: '🔄',
        thinking: '🧠',
        tool_start: '🔧',
        tool_complete: '✅',
        answer_start: '💬',
        answer_done: '✨',
        agent_complete: '🏁',
        step_usage: '📊'
    }
    return icons[type] || '•'
}

const eventLabel = (evt) => {
    switch (evt.type) {
        case 'context_loaded':
            return `Context loaded — ${evt.historyCount || 0} messages${evt.hasSmartContext ? ', smart context ✓' : ''}`
        case 'agent_step':
            return `Step ${evt.step}/${evt.maxSteps}`
        case 'thinking':
            return evt.message || 'Thinking...'
        case 'tool_start':
            return `${evt.toolName}(${typeof evt.input === 'object' ? JSON.stringify(evt.input).substring(0, 60) : String(evt.input || '').substring(0, 60)})`
        case 'tool_complete': {
            const dur = evt.durationMs ? ` (${(evt.durationMs / 1000).toFixed(1)}s)` : ''
            const status = evt.success ? '✓' : '✗'
            return `${evt.toolName} → ${status}${dur}`
        }
        case 'answer_start':
            return `Generating answer — ${evt.answerMode || 'internal'} mode`
        case 'answer_done':
            return `Answer complete — ${evt.fullLength || '?'} chars`
        case 'agent_complete': {
            const dur = evt.durationMs ? ` in ${(evt.durationMs / 1000).toFixed(1)}s` : ''
            return `Done — ${evt.totalSteps} step(s), ${evt.totalTokens || '?'} tokens${dur}`
        }
        case 'step_usage':
            return `Tokens: in=${evt.input || 0} out=${evt.output || 0}`
        default:
            return evt.type
    }
}

const isToolEvent = (type) => type === 'tool_start' || type === 'tool_complete'
const isSubEvent = (type) => ['thinking', 'tool_start', 'tool_complete', 'step_usage'].includes(type)



const viewImage = (src) => {
    viewingImage.value = src
}

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

const downloadAttachment = async (att) => {
    if (att.key) {
        try {
            // Use api.get to ensure Auth header is sent
            const response = await api.get(`/chat/attachment/${att.key}`, { responseType: 'blob' });
            
            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data], { type: response.headers['content-type'] }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', att.fileName || 'download'); // Browser will use header if available, but this helps fallbacks
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed', error);
            alert('Download failed. ' + (error.response?.data?.error || 'Access Denied or Server Error'));
        }
    } else if (att.url) {
        window.open(att.url, '_blank');
    } else {
        console.warn('No key or URL for attachment', att);
    }
}

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}



</script>

<template>
  <div class="message-wrapper" :class="message.role">
    <!-- USER: Bubble style -->
    <template v-if="message.role === 'user'">
      <div class="user-row">
        <div class="content-stack">
            <!-- Images (Outside Bubble) -->
            <div v-if="message.images && message.images.length > 0" class="message-images outside">
                <img 
                    v-for="(img, index) in message.images" 
                    :key="index"
                    :src="`data:${img.mediaType};base64,${img.data}`" 
                    class="msg-image clickable"
                    alt="Attached image"
                    @click="viewImage(`data:${img.mediaType};base64,${img.data}`)"
                />
            </div>

            <!-- Documents (Outside Bubble) -->
            <div v-if="message.files && message.files.length > 0" class="message-files outside">
                <div v-for="(file, index) in message.files" :key="index" class="msg-file">
                    <div class="file-icon">
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                    </div>
                    <div class="file-info-stack">
                        <span class="file-name" :title="file.name">{{ file.name }}</span>
                        <!-- Embedded Progress Bar -->
                        <div v-if="message.fileProgress && message.fileProgress.currentFile === file.name" class="embedded-progress">
                             <div class="progress-bar-track small">
                                <div class="progress-bar-fill" :style="{ width: message.fileProgress.percent + '%' }"></div>
                             </div>
                             <span class="progress-text">{{ message.fileProgress.percent }}% - {{ message.fileProgress.detail }}</span>
                        </div>
                        <div v-else class="file-size">Uploading...</div>
                    </div>
                </div>
            </div>

            <!-- Persisted Attachments (History) -->
            <div v-if="message.attachments && message.attachments.length > 0" class="message-files outside">
                <div v-for="(att, index) in message.attachments" :key="index" class="msg-file clickable" @click="downloadAttachment(att)" :title="att.fileName">
                    <div class="file-icon">
                         <span v-if="att.mimeType && att.mimeType.includes('image')">📷</span>
                         <span v-else-if="att.mimeType && (att.mimeType.includes('pdf') || att.fileName.endsWith('.pdf'))">📄</span>
                         <span v-else-if="att.mimeType && (att.mimeType.includes('sheet') || att.mimeType.includes('excel'))">📊</span>
                         <span v-else>📎</span>
                    </div>
                    <div class="file-info-stack">
                        <span class="file-name">{{ att.fileName }}</span>
                        <!-- Embedded Progress Bar (Shared with persist attachment if processing continues) -->
                        <div v-if="message.fileProgress && message.fileProgress.currentFile === att.fileName" class="embedded-progress">
                             <div class="progress-bar-track small">
                                <div class="progress-bar-fill" :style="{ width: message.fileProgress.percent + '%' }"></div>
                             </div>
                             <span class="progress-text">{{ message.fileProgress.percent }}% - {{ message.fileProgress.detail }}</span>
                        </div>
                        <div v-else class="file-size">{{ formatBytes(att.fileSize) }}</div>
                    </div>
                </div>
            </div>

            <div class="bubble user">
                <p v-if="message.content">{{ message.content }}</p>
                <p v-else-if="!(message.images?.length > 0) && !(message.files?.length > 0)" class="empty-content">Sent a file</p>
            </div>
            <!-- Copy Button Below Bubble -->
            <div class="user-actions">
                <button class="btn-icon-copy fade-hover" @click="handleCopy" :class="{ copied }" :title="t('copy')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect v-if="!copied" x="9" y="9" width="13" height="13" rx="2"/>
                    <path v-if="!copied" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    <polyline v-else points="20 6 9 17 4 12"/>
                    </svg>
                </button>
            </div>
        </div>

        <!-- Avatar -->
        <div class="avatar-circle user">
             <img v-if="userAvatarUrl" :src="userAvatarUrl" class="avatar-img" alt="User" referrerpolicy="no-referrer" />
             <span v-else>{{ userInitial }}</span>
        </div>
      </div>

    <!-- Lightbox Modal -->
    <Teleport to="body">
        <div v-if="viewingImage" class="lightbox-overlay" @click="viewingImage = null">
            <button class="btn-close-lightbox">&times;</button>
            <img :src="viewingImage" class="lightbox-img" @click.stop />
        </div>
    </Teleport>
    </template>
    
    <!-- ASSISTANT: Canvas style (improved) -->
    <template v-else>
      <div class="assistant-canvas">
        <div class="avatar-circle assistant">
          <img src="@/assets/dindin-ai.png" alt="AI Avatar" class="avatar-img" />
        </div>
        
        <div class="content-col">
          <div class="assistant-header">
            <span class="name">{{ t('aiAssistant') }}</span>
            <div v-if="message.meta?.confidence" class="confidence-badge" :class="message.meta.confidence.toLowerCase()">
                <div class="badge-content">
                    <span class="conf-dot"></span>
                    <span class="conf-text">{{ message.meta.confidence }} Confidence</span>
                </div>
                
                <div class="explanation-tooltip" v-if="message.meta.explanation">
                    <div class="tooltip-header" :class="message.meta.confidence.toLowerCase()">
                        {{ message.meta.confidence }} Confidence
                    </div>
                    <div class="tooltip-row"><strong>Basis:</strong> {{ message.meta.explanation.basis }}</div>
                    <div class="tooltip-row" v-if="message.meta.confidence === 'Low' && message.meta.explanation.missing_info?.length">
                         <strong>Gap:</strong> {{ message.meta.explanation.missing_info[0] }}
                    </div>
                </div>
            </div>
          </div>
          
          
          <!-- ══ Agent Flow Timeline (BEFORE answer — shows real-time progression) ══ -->
          <div v-if="hasAgentEvents" class="agent-flow-container">
            <button
              class="agent-flow-toggle"
              @click="toggleFlow"
              :class="{ expanded: flowExpanded }"
            >
              <span class="flow-icon">🤖</span>
              <span class="flow-label">
                Agent Flow
                <template v-if="agentSummary">
                  ({{ agentSummary.steps }} step{{ agentSummary.steps !== 1 ? 's' : '' }}<template v-if="agentSummary.durationStr">, {{ agentSummary.durationStr }}</template>)
                </template>
              </span>
              <span v-if="!agentSummary?.isComplete && isStreaming" class="flow-streaming-dot"></span>
              <svg class="flow-chevron" :class="{ rotated: flowExpanded }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            <Transition name="slide-down">
              <div v-if="flowExpanded" class="agent-flow-timeline">
                <div
                  v-for="(evt, idx) in timelineEvents"
                  :key="idx"
                  class="timeline-event"
                  :class="{ 'sub-event': isSubEvent(evt.type), 'tool-event': isToolEvent(evt.type) }"
                >
                  <span class="event-connector">
                    <span class="connector-line" v-if="idx < timelineEvents.length - 1 || (!agentSummary?.isComplete && isStreaming)"></span>
                    <span class="connector-dot">{{ eventIcon(evt.type) }}</span>
                  </span>
                  <span class="event-content">
                    <span class="event-label">{{ eventLabel(evt) }}</span>
                    <!-- Show tool result preview for tool_complete -->
                    <span v-if="evt.type === 'tool_complete' && evt.resultPreview" class="event-detail">
                      {{ evt.resultPreview.substring(0, 120) }}{{ evt.resultPreview.length > 120 ? '...' : '' }}
                    </span>
                  </span>
                </div>

                <!-- Streaming indicator at bottom -->
                <div v-if="!agentSummary?.isComplete && isStreaming" class="timeline-event active">
                  <span class="event-connector">
                    <span class="connector-dot pulse">⏳</span>
                  </span>
                  <span class="event-content">
                    <span class="event-label animate-flicker">{{ message.status || 'Processing...' }}</span>
                  </span>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Answer content (appears AFTER agent flow — the final step) -->
          <div ref="messageRef" class="prose-content prose" v-if="message.content" v-html="render(message.content)"></div>
          
          <!-- Typing Indicator — ONLY when NO agent events (fallback for non-agent responses) -->
          <div v-if="!message.content && !hasAgentEvents" class="typing-indicator">
            <div class="dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span class="text animate-flicker">{{ message.status || t('thinking') }}</span>
          </div>

          <!-- AI Actions (Copy Button icon only) -->
          <div class="actions" v-if="message.content">
            <button class="btn-icon-copy" @click="handleCopy" :class="{ copied }" :title="t('copy')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect v-if="!copied" x="9" y="9" width="13" height="13" rx="2"/>
                <path v-if="!copied" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                <polyline v-else points="20 6 9 17 4 12"/>
              </svg>
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
  overflow: hidden;
}

.avatar-circle.user {
  background: var(--color-user-gradient);
  color: white;
}

.avatar-circle.assistant {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  padding: 2px;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

/* === USER STYLES === */
.user-row {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-left: 20%;
}

.content-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-end; /* Align bubble and copy button to right */
    gap: 4px;
    max-width: 100%; /* Ensure it takes space but respects parent flex */
}

.bubble.user {
  background: var(--color-bg-secondary); 
  color: var(--color-text-primary);
  padding: 12px 18px;
  border-radius: 18px;
  border-bottom-right-radius: 4px;
  box-shadow: var(--shadow-sm);
  /* removed flex/gap since button moved out */
}

.bubble.user p {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.user-actions {
    height: 24px; /* fixed height to prevent jumping */
    display: flex;
    align-items: center;
}

@media (max-width: 768px) {
    .user-row {
        padding-left: 10%; 
    }
    
    .bubble.user {
        padding: 10px 14px;
        font-size: 14px; 
    }
}

/* === ASSISTANT STYLES === */
.assistant-canvas {
  display: flex;
  gap: 16px;
  padding-right: 5%;
}

@media (max-width: 768px) {
    .assistant-canvas {
        gap: 12px;
        padding-right: 2%;
    }
    .avatar-circle {
        width: 32px;
        height: 32px;
        font-size: 16px;
    }
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




/* Improved Prose (Markdown) */
.prose-content {
  font-size: 15px;
  line-height: 1.75;
  color: var(--color-text-primary);
}

/* Typing Indicator */
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
  font-weight: 500;
}

.animate-flicker {
    animation: flicker 2s infinite ease-in-out;
}

@keyframes flicker {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
}

.intent-badge-mini {
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 10px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    font-weight: 500;
    letter-spacing: 0.2px;
}

.intent-badge-mini.fact_lookup { border-color: #3b82f6; color: #3b82f6; background: rgba(59, 130, 246, 0.05); }
.intent-badge-mini.debugging { border-color: #ef4444; color: #ef4444; background: rgba(239, 68, 68, 0.05); }
.intent-badge-mini.research { border-color: #8b5cf6; color: #8b5cf6; background: rgba(139, 92, 246, 0.05); }




.actions {
  margin-top: 8px;
  display: flex;
}

/* === SHARED BUTTON STYLES === */
.btn-icon-copy {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.btn-icon-copy:hover {
  color: var(--color-primary);
  background: var(--color-bg-tertiary);
}

.btn-icon-copy.copied {
  color: var(--color-success);
}

/* Fade Hover Effect for User Actions */
.fade-hover {
    opacity: 0;
    transition: opacity 0.2s ease, color 0.2s ease, background 0.2s ease;
}

.user-row:hover .fade-hover {
    opacity: 1;
}

.message-images {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 4px;
    justify-content: flex-end; /* Align right for user */
}

.msg-image {
    max-width: 200px;
    max-height: 200px;
    border-radius: 12px;
    object-fit: cover;
    border: 1px solid var(--color-border);
    transition: transform 0.2s;
}

.msg-image.clickable {
    cursor: zoom-in;
}

.msg-image.clickable:hover {
    transform: scale(1.02);
}

.empty-content {
    color: var(--color-text-muted);
    font-style: italic;
    font-size: 13px;
    margin: 0;
}

/* Lightbox */
.lightbox-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.85);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease;
}

.lightbox-img {
    max-width: 90vw;
    max-height: 90vh;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    animation: zoomIn 0.2s ease;
}

.btn-close-lightbox {
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    font-size: 30px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}

.btn-close-lightbox:hover {
    background: rgba(255,255,255,0.4);
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes zoomIn { from { transform: scale(0.9); } to { transform: scale(1); } }

.message-images {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 4px;
    justify-content: flex-end; /* Align right for user */
}

.message-files {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
    align-items: flex-end;
}

.msg-file {
    display: flex;
    align-items: center;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 8px 12px;
    gap: 8px;
    max-width: 250px;
}

.msg-file.clickable {
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
}

.msg-file.clickable:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-primary-light, #a5b4fc);
}

.msg-file .file-icon {
    color: var(--color-text-muted);
    font-size: 16px;
    display: flex;
    align-items: center;
}

.file-info-stack {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.msg-file .file-name {
    font-size: 13px;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
}

.msg-file .file-size {
    font-size: 11px;
    color: var(--color-text-muted);
}

.msg-image {
    max-width: 200px;
    max-height: 200px;
    border-radius: 8px;
    object-fit: cover;
    border: 1px solid rgba(255,255,255,0.1);
}

/* Confidence Badge & Tooltip Styles */
.confidence-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 12px;
    margin-left: 8px;
    cursor: help;
    position: relative;
    user-select: none;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    
    /* Ghost Behavior: Invisible by default */
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.2s ease;
}

/* Show badge when hovering the entire Assistant Message Row */
.assistant-canvas:hover .confidence-badge {
    opacity: 1;
}

.badge-content {
    display: flex;
    align-items: center;
    gap: 6px;
}

.conf-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
}

.confidence-badge.high {
    background: #ecfdf5;
    color: #059669;
    border: 1px solid #a7f3d0;
}

.confidence-badge.medium {
    background: #fffbeb;
    color: #d97706;
    border: 1px solid #fde68a;
}

.confidence-badge.low {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
}

/* Explanation Tooltip */
.explanation-tooltip {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    width: 280px; /* Restored width for text */
    background: var(--color-bg-tertiary, #ffffff);
    color: var(--color-text-primary, #111827);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 12px;
    box-shadow: var(--shadow-lg);
    z-index: 100;
    margin-top: 8px;
    text-transform: none;
    letter-spacing: normal;
    font-weight: 400;
    font-size: 12px;
}

.tooltip-header {
    font-weight: 600;
    margin-bottom: 4px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    justify-content: space-between;
}

.tooltip-header.high { color: #059669; }
.tooltip-header.medium { color: #d97706; }
.tooltip-header.low { color: #dc2626; }

.confidence-badge:hover .explanation-tooltip {
    display: block;
}

/* File Progress Bar */
.file-progress-container {
    margin: 8px 0;
    padding: 12px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    width: 280px;
    font-size: 13px;
}

.progress-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    font-weight: 500;
    color: var(--color-text-primary);
}

.progress-info .icon { margin-right: 6px; }

.progress-bar-track {
    height: 6px;
    background: var(--color-bg-tertiary);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 6px;
}

.progress-bar-fill {
    height: 100%;
    background: var(--color-accent);
    transition: width 0.3s ease;
}

.progress-detail {
    font-size: 12px;
    color: var(--color-text-muted);
}

/* Embedded Progress Bar */
.embedded-progress {
    width: 100%;
}

.progress-bar-track.small {
    height: 4px;
    background: var(--color-bg-tertiary);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 4px;
}

.progress-text {
    font-size: 10px;
    color: var(--color-text-muted);
    margin-top: 2px;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* ══════════════════ Agent Flow Timeline ══════════════════ */
.agent-flow-container {
    margin-top: 12px;
    border-top: 1px solid var(--color-border, rgba(255,255,255,0.08));
    padding-top: 8px;
}

.agent-flow-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 1px solid var(--color-border, rgba(255,255,255,0.1));
    border-radius: 8px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
    color: var(--color-text-muted, #999);
    transition: all 0.2s ease;
    width: 100%;
    text-align: left;
}

.agent-flow-toggle:hover {
    background: var(--color-bg-tertiary, rgba(255,255,255,0.04));
    color: var(--color-text-primary, #ddd);
    border-color: var(--color-accent, #6366f1);
}

.agent-flow-toggle.expanded {
    border-color: var(--color-accent, #6366f1);
    background: var(--color-bg-tertiary, rgba(255,255,255,0.02));
}

.flow-icon {
    font-size: 14px;
}

.flow-label {
    flex: 1;
    font-weight: 500;
}

.flow-streaming-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-accent, #6366f1);
    animation: pulse-dot 1.2s ease-in-out infinite;
}

@keyframes pulse-dot {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.2); }
}

.flow-chevron {
    transition: transform 0.25s ease;
    flex-shrink: 0;
}

.flow-chevron.rotated {
    transform: rotate(180deg);
}

/* Timeline */
.agent-flow-timeline {
    padding: 8px 0 4px 6px;
}

.timeline-event {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 3px 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-text-secondary, #bbb);
}

.timeline-event.sub-event {
    padding-left: 16px;
    font-size: 11px;
    color: var(--color-text-muted, #888);
}

.timeline-event.tool-event {
    font-size: 11px;
}

.timeline-event.active .event-label {
    color: var(--color-accent, #6366f1);
}

.event-connector {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 20px;
}

.connector-dot {
    font-size: 12px;
    z-index: 1;
    line-height: 1;
}

.connector-dot.pulse {
    animation: pulse-dot 1.2s ease-in-out infinite;
}

.connector-line {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    width: 1px;
    height: calc(100% + 4px);
    background: var(--color-border, rgba(255,255,255,0.1));
}

.event-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
}

.event-label {
    word-break: break-word;
}

.event-detail {
    font-size: 10px;
    color: var(--color-text-muted, #777);
    background: var(--color-bg-tertiary, rgba(255,255,255,0.03));
    padding: 4px 8px;
    border-radius: 4px;
    font-family: 'Fira Code', 'Cascadia Code', monospace;
    max-height: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-all;
}

/* Slide down transition */
.slide-down-enter-active,
.slide-down-leave-active {
    transition: all 0.25s ease;
    overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
    opacity: 0;
    max-height: 0;
    transform: translateY(-8px);
}

.slide-down-enter-to,
.slide-down-leave-from {
    opacity: 1;
    max-height: 500px;
    transform: translateY(0);
}
</style>

