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
    const rawEvents = props.message.agentEvents.filter(e =>
        ['thinking', 'tool_start', 'tool_complete', 'answer_start', 'agent_complete'].includes(e.type)
    )

    // Merge logic for Thinking events
    const mergedEvents = []
    const thinkingByStep = {} // Map step -> event index in mergedEvents

    // Identify current max step to know which is "active"
    const maxStep = Math.max(...rawEvents.map(e => e.step || 0), 0)
    const isComplete = props.message.agentEvents.some(e => e.type === 'agent_complete' || e.type === 'answer_done')

    rawEvents.forEach(evt => {
        if (evt.type === 'thinking') {
            const step = evt.step
            const isPlaceholder = evt.message && evt.message.startsWith('กำลังวิเคราะห์...')

            if (thinkingByStep[step] !== undefined) {
                // If we already have a thinking event for this step
                const existingIndex = thinkingByStep[step]
                // If new one is NOT a placeholder, replace the existing one
                if (!isPlaceholder && evt.message && evt.message.trim()) {
                    mergedEvents[existingIndex] = { ...evt, isActive: false }
                }
            } else {
                // New step for thinking
                if (!isPlaceholder && evt.message && evt.message.trim()) {
                    // Has content -> Add it
                    mergedEvents.push({ ...evt, isActive: false })
                    thinkingByStep[step] = mergedEvents.length - 1
                } else {
                    // Is placeholder. Only add if it's potentially active (latest step & not complete)
                    if (!isComplete && step === maxStep) {
                        mergedEvents.push({ ...evt, isActive: true })
                        thinkingByStep[step] = mergedEvents.length - 1
                    }
                    // Otherwise skip (hides old/empty placeholders)
                }
            }
        } else {
            mergedEvents.push(evt)
        }
    })

    return mergedEvents
})

// Show Agent Flow immediately when streaming starts (before events arrive) Or if we have valid timeline events
const showAgentFlow = computed(() => {
    return props.isStreaming || (hasAgentEvents.value && timelineEvents.value.length > 0)
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
        case 'thinking':
            return evt.message || 'Thinking...'
        case 'tool_start':
            return `Used Tool: ${evt.toolName}` // Simplified
        case 'tool_complete': {
            const status = evt.success ? 'Success' : 'Failed'
            return `Tool ${evt.toolName}: ${status}`
        }
        case 'answer_start':
            return `Compiling answer...`
        case 'agent_complete': {
            return `Finished`
        }
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
          
          
          <!-- ══ Agent Flow (Redesigned Round 3) ══ -->
          <div v-if="showAgentFlow" class="agent-flow-container">
            <!-- Collapsed Header (DIV instead of BUTTON to avoid global styles) -->
            <div 
                class="agent-flow-header" 
                @click="toggleFlow"
                role="button"
                tabindex="0"
            >
                <div class="header-left">
                    <span class="icon-indicator">
                        <svg v-if="flowExpanded" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                             <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </span>
                    <span class="status-text no-wrap">
                        {{ agentSummary?.isComplete ? 'Thoughts' : 'Working...' }}
                    </span>
                </div>
            </div>

            <!-- Expanded Content: Premium Timeline with Animations -->
            <div v-if="flowExpanded" class="agent-flow-content custom-scroll">
                <TransitionGroup name="list" tag="div" class="timeline-container">
                    <div v-for="(evt, idx) in timelineEvents" :key="evt.id || idx" class="timeline-item">
                        <!-- Timeline Left: Icon & Line -->
                        <div class="timeline-left">
                            <div class="timeline-line"></div>
                            
                            <!-- Icon: Thinking -->
                            <div v-if="evt.type === 'thinking'" class="timeline-icon thinking" :class="{ 'pulse-active': evt.isActive }">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                                </svg>
                            </div>
                            
                            <!-- Icon: Tool Start -->
                            <div v-else-if="evt.type === 'tool_start'" class="timeline-icon tool">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                                </svg>
                            </div>
                            
                            <!-- Icon: Tool Complete -->
                            <div v-else-if="evt.type === 'tool_complete'" class="timeline-icon success">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>

                            <!-- Icon: Default -->
                            <div v-else class="timeline-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="1"></circle>
                                    <circle cx="19" cy="12" r="1"></circle>
                                    <circle cx="5" cy="12" r="1"></circle>
                                </svg>
                            </div>
                        </div>

                        <!-- Timeline Right: Premium Content Card -->
                        <div class="timeline-right">
                            <!-- Thinking Card -->
                            <div v-if="evt.type === 'thinking'" class="flow-card glass-card thinking-card">
                                <div class="card-header">
                                    <span class="header-title">Thinking Process</span>
                                    <span class="header-badge">Step {{ evt.step }}</span>
                                </div>
                                <div class="card-body markdown-body">
                                    <div v-if="evt.isActive" class="thinking-placeholder">
                                        <span class="dot-flashing"></span>
                                        <span class="text">Analyzing...</span>
                                    </div>
                                    <div v-else v-html="render(evt.message)"></div>
                                </div>
                            </div>

                            <!-- Tool Use Card -->
                            <div v-else-if="evt.type === 'tool_start'" class="flow-card glass-card tool-card">
                                <div class="card-header">
                                    <span class="header-title">Executing Tool</span>
                                </div>
                                <div class="tool-command-box">
                                    <span class="prompt">$</span> {{ evt.toolName }}
                                </div>
                            </div>

                            <!-- Tool Result Card -->
                            <div v-else-if="evt.type === 'tool_complete'" class="flow-card glass-card result-card">
                                <div class="result-badge" :class="evt.success ? 'success' : 'failure'">
                                    {{ evt.success ? 'Success' : 'Failed' }}
                                </div>
                                <div v-if="evt.resultPreview" class="result-preview-text">
                                    {{ evt.resultPreview.substring(0, 150) }}{{ evt.resultPreview.length > 150 ? '...' : '' }}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Streaming Pulse Indicator -->
                    <div v-if="!agentSummary?.isComplete && isStreaming" key="streaming-pulse" class="timeline-item">
                        <div class="timeline-left">
                            <div class="timeline-icon pulse">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                            </div>
                        </div>
                         <div class="timeline-right">
                            <div class="flow-card glass-card ghost">
                                <div class="card-body fade-text">Processing...</div>
                            </div>
                        </div>
                    </div>
                </TransitionGroup>
            </div>
          </div>

          <!-- Answer content -->
          <div ref="messageRef" class="prose-content prose" v-if="message.content" v-html="render(message.content)"></div>
          
          <!-- Typing Indicator (Legacy/Fallback) -->
          <div v-if="!message.content && !showAgentFlow" class="typing-indicator">
             <div class="dots"><span></span><span></span><span></span></div>
          </div>

          <!-- AI Actions -->
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
  text-decoration: none;
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

/* ══════════════════ Agent Flow Timeline (Premium) ══════════════════ */
.agent-flow-container {
    margin-top: 12px;
    border-top: 1px solid var(--color-border);
    padding-top: 8px;
    width: 100%;
    display: flex;
    flex-direction: column;
}

/* Header */
.agent-flow-header {
    appearance: none; -webkit-appearance: none;
    background: transparent; border: none; padding: 6px 0;
    cursor: pointer;
    display: flex; align-items: center;
    color: var(--color-text-muted);
    font-size: 13px; font-weight: 500;
    transition: color 0.2s;
    outline: none;
    width: 100%;
    user-select: none;
}
.agent-flow-header:hover { color: var(--color-text-primary); }
.header-left { display: flex; align-items: center; gap: 8px; width: 100%; }
.status-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; }
.icon-indicator { display: flex; align-items: center; justify-content: center; }

/* Timeline Area */
.agent-flow-content {
    margin-top: 12px;
    display: flex; flex-direction: column;
    gap: 0;
    padding-left: 4px;
    max-height: 500px;
    overflow-y: auto; overflow-x: hidden;
    padding-bottom: 8px;
    /* Custom Scrollbar */
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
}

.timeline-item {
    display: flex;
    gap: 16px;
    position: relative;
    padding-bottom: 24px;
    /* animation: flowSlideIn 0.3s ease-out forwards; */
}

/* List Transitions */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.list-leave-active {
  position: absolute;
}

.timeline-left {
    display: flex; flex-direction: column; align-items: center;
    width: 24px; flex-shrink: 0;
    position: relative;
    padding-top: 2px;
}

.timeline-line {
    position: absolute;
    top: 28px; bottom: -20px;
    width: 2px;
    background: var(--color-border);
    opacity: 0.3;
    z-index: 1;
}
.timeline-item:last-child .timeline-line { display: none; }

.timeline-icon {
    width: 24px; height: 24px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    z-index: 2;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.timeline-icon.thinking { color: #6b7280; background: #f9fafb; }
.timeline-icon.tool { color: #0284c7; background: #e0f2fe; border-color: #bae6fd; }
.timeline-icon.success { color: #16a34a; background: #dcfce7; border-color: #bbf7d0; }
.timeline-icon.pulse { animation: pulse 1.5s infinite; color: var(--color-primary); border-color: var(--color-primary); }

.timeline-right {
    flex: 1;
    min-width: 0;
}

/* Content Cards - GitHub Style */
.flow-card {
    border-radius: 6px; /* GitHub radius */
    padding: 0; /* Header/Body structure requires 0 padding on wrapper */
    width: 100%;
    overflow: hidden;
    border: 1px solid #d0d7de;
    background: #ffffff;
    box-shadow: none;
}

/* Specific Card Types */
.thinking-card {
    /* Standard GitHub Box */
}

.card-header {
    background: #f6f8fa;
    border-bottom: 1px solid #d0d7de;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 600;
    color: #57606a;
}

.card-body {
    padding: 12px;
}

.tool-card {
    background: #24292f; /* Dark terminal background for tools */
    border-color: #24292f;
}

.tool-card .card-header {
    background: #1f2428;
    border-bottom: 1px solid #3e444d;
    color: #c9d1d9;
}

.tool-card .tool-command-box {
    color: #e6edf3;
    padding: 12px;
}

.result-card {
    border-color: #d0d7de;
}

.glass-card {
    /* Legacy override removal */
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
}

.ghost {
    background: #f6f8fa;
    border: 1px dashed #d0d7de;
    color: #57606a;
}
.ghost .card-body {
    padding: 8px 12px;
    font-style: italic;
}

/* Dark Mode Overrides for Cards */
html[data-theme="dark"] .flow-card {
    background: #0d1117; /* GitHub Dark Bg */
    border-color: #30363d;
}

html[data-theme="dark"] .card-header {
    background: #161b22; /* GitHub Dark Dimmed Header */
    border-bottom-color: #30363d;
    color: #768390;
}

html[data-theme="dark"] .tool-card {
    background: #0d1117; 
    border-color: #30363d;
}

html[data-theme="dark"] .thinking-card {
    background: #0d1117;
}

html[data-theme="dark"] .ghost {
    background: #161b22;
    border-color: #30363d;
    color: #768390;
}

/* Remove old glass classes influence */
.glass-card.thinking-card, 
.glass-card.tool-card,
.glass-card.result-card {
    background: unset; 
    /* allowed to be overridden by above specific styles */
}

/* Dark Mode Overrides (assuming a class or media query, but let's stick to variables if possible) */
/* Ideally we'd use CSS variables for these RGBA values if the app supports it.
   Start by using variables if available, otherwise fallback.
   I'll assume standard app variables for now.
*/

.card-header {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 11px; font-weight: 700;
    color: var(--color-text-muted);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.header-badge {
    background: rgba(0,0,0,0.05);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
}

.card-body.markdown-body {
    font-size: 14px;
    line-height: 1.6;
    color: var(--color-text-secondary);
    white-space: pre-wrap;
}

.tool-command-box {
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.5;
    color: #e5e7eb; /* Light text for dark terminal */
}
.prompt { color: #4ade80; margin-right: 8px; user-select: none;}

.result-badge {
    display: inline-flex;
    font-size: 11px; font-weight: 600;
    padding: 2px 8px; border-radius: 4px;
    margin-bottom: 6px;
}
.result-badge.success { background: #dcfce7; color: #166534; }
.result-badge.failure { background: #fee2e2; color: #991b1b; }

.result-preview-text {
    font-size: 13px;
    color: var(--color-text-secondary);
    font-family: monospace;
    opacity: 0.85;
}

.fade-text {
    color: var(--color-text-muted);
    font-style: italic;
    font-size: 13px;
    animation: flicker 2s infinite;
}

@keyframes flicker {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
}

@keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(var(--color-primary-rgb), 0.4); }
    70% { box-shadow: 0 0 0 6px rgba(var(--color-primary-rgb), 0); }
}

/* Scrollbar */
.agent-flow-content::-webkit-scrollbar { width: 4px; }
.agent-flow-content::-webkit-scrollbar-track { background: transparent; }
.agent-flow-content::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }

/* Responsive */
@media (max-width: 768px) {
    .agent-flow-content {
        max-height: 350px;
    }
}
</style>

<!-- Non-scoped style for Dark Mode overrides to ensure they target html[data-theme] correctly -->
<style>
/* === Dark Mode Support (Redesigned for High Contrast) === */
html[data-theme="dark"] .glass-card {
    background: rgba(30, 41, 59, 0.95) !important; /* Slate-800, almost opaque */
    border-color: rgba(51, 65, 85, 0.8) !important; /* Slate-700 */
    color: #f8fafc !important; /* Slate-50 - High Contrast */
}

html[data-theme="dark"] .glass-card.thinking-card {
    background: rgba(30, 41, 59, 0.95) !important;
    border-color: #334155 !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
}

html[data-theme="dark"] .glass-card.tool-card {
    background: #020617 !important; /* Slate-950/Black for terminal feel */
    border-color: #1e293b !important; /* Slate-800 */
    box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.3);
}

html[data-theme="dark"] .glass-card.result-card {
    background: #171717 !important; /* Neutral-900 */
    border-color: #404040 !important; /* Neutral-700 */
}

html[data-theme="dark"] .timeline-icon {
    background: #1e293b !important; /* Slate-800 */
    border-color: #334155 !important; /* Slate-700 */
    color: #cbd5e1 !important; /* Slate-300 */
}

html[data-theme="dark"] .timeline-icon.thinking {
    background: #1e293b !important;
    color: #94a3b8 !important;
}

/* Ensure text visibility in dark mode */
html[data-theme="dark"] .card-header {
    color: #cbd5e1 !important; /* Slate-300 */
}

html[data-theme="dark"] .header-title {
    color: #f8fafc !important; /* Slate-50 */
    font-weight: 700;
}

html[data-theme="dark"] .card-body.markdown-body {
    color: #f8fafc !important; /* Slate-50 */
}

html[data-theme="dark"] .card-body.markdown-body p,
html[data-theme="dark"] .card-body.markdown-body li,
html[data-theme="dark"] .card-body.markdown-body span,
html[data-theme="dark"] .card-body.markdown-body strong {
    color: #f8fafc !important;
}

html[data-theme="dark"] .card-body.markdown-body code {
    background: rgba(0, 0, 0, 0.3) !important;
    border: 1px solid #334155 !important;
    color: #e2e8f0 !important;
}

html[data-theme="dark"] .tool-command-box {
    color: #f8fafc !important;
    font-weight: 500;
}

html[data-theme="dark"] .result-preview-text {
    color: #e2e8f0 !important; /* Slate-200 */
}

html[data-theme="dark"] .timeline-line {
    background: #334155 !important; /* Slate-700 */
}

html[data-theme="dark"] .status-text {
    color: #f8fafc !important;
}

html[data-theme="dark"] .agent-flow-header:hover .status-text {
    color: #ffffff !important;
    text-shadow: 0 0 10px rgba(255,255,255,0.3);
}

html[data-theme="dark"] .fade-text {
    color: #94a3b8 !important;
}
</style>

<style scoped>
/* Thinking Placeholder Animation */
.thinking-placeholder {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    color: var(--color-text-muted);
    font-style: italic;
}

.timeline-icon.thinking.pulse-active {
    color: var(--color-primary);
    animation: pulse-ring 2s infinite;
}

@keyframes pulse-ring {
    0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
    70% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0); }
    100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
}

.dot-flashing {
  position: relative;
  width: 6px;
  height: 6px;
  border-radius: 5px;
  background-color: var(--color-primary);
  color: var(--color-primary);
  animation: dot-flashing 1s infinite linear alternate;
  animation-delay: 0.5s;
}
.dot-flashing::before, .dot-flashing::after {
  content: "";
  display: inline-block;
  position: absolute;
  top: 0;
}
.dot-flashing::before {
  left: -10px;
  width: 6px;
  height: 6px;
  border-radius: 5px;
  background-color: var(--color-primary);
  color: var(--color-primary);
  animation: dot-flashing 1s infinite alternate;
  animation-delay: 0s;
}
.dot-flashing::after {
  left: 10px;
  width: 6px;
  height: 6px;
  border-radius: 5px;
  background-color: var(--color-primary);
  color: var(--color-primary);
  animation: dot-flashing 1s infinite alternate;
  animation-delay: 1s;
}

@keyframes dot-flashing {
  0% { background-color: var(--color-primary); }
  50%, 100% { background-color: rgba(99, 102, 241, 0.2); }
}
</style>
