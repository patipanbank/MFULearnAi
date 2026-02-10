<script setup>
import { useMarkdown } from '@/composables/useMarkdown'
import { ref, computed, onMounted, nextTick, watch } from 'vue'

const props = defineProps({
  message: { type: Object, required: true },
  userInitial: { type: String, default: 'U' },
  userAvatarUrl: { type: String, default: '' },
  t: { type: Function, required: true }
})

const emit = defineEmits(['copy', 'view-evidence'])

const { render, copyToClipboard } = useMarkdown()
const copied = ref(false)
const viewingImage = ref(null)
const messageRef = ref(null) // Reference to the message container

// Citation Indexing State
const citationMap = computed(() => {
    if (!props.message.meta?.injected_evidence) return new Map()
    
    const map = new Map()
    let counter = 1
    props.message.meta.injected_evidence.forEach(ev => {
        if (!map.has(ev.id)) {
            map.set(ev.id, {
                order: counter++,
                evidence: ev
            })
        }
    })
    return map
})

// Bind citations after render
const bindCitations = async () => {
    await nextTick()
    if (!messageRef.value) return

    const tokens = messageRef.value.querySelectorAll('.citation-token')
    tokens.forEach(node => {
        const id = node.dataset.citationId
        const entry = citationMap.value.get(id)
        
        // Remove existing listeners to be safe (though Vue re-renders usually handle this)
        // With v-html, we are outside Vue's reactivity for these nodes.
        // Cloning node is a trick to strip listeners, but might be overkill.
        // Simple onclick assignment is effective here.
        
        if (entry) {
            node.textContent = `[${entry.order}]`
            node.classList.add('valid')
            node.onclick = (e) => {
                e.stopPropagation()
                emit('view-evidence', entry.evidence)
            }
        } else {
             // Fallback for missing evidence (shouldn't happen with strict backend)
             node.textContent = `[?]`
             node.classList.add('invalid')
             node.title = "Citation source not found"
        }
    })
}

// Watch for content changes to re-bind
watch(() => props.message.content, bindCitations, { immediate: true })

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

const openSource = async (source) => {
    if (!source || !source.id) return
    
    // Check if we have evidence object for this source in the map
    // If so, emit view-evidence to open our new viewer
    // If not (e.g. legacy or internal link), fallback to old behavior
    
    // Try to find evidence by fileId matching source.id? 
    // Usually source object in 'meta.sources' is {id, name}. 
    // meta.injected_evidence has {id: blockId, fileName...}.
    // They are different IDs usually (FileID vs BlockID).
    
    // For now, keep legacy openSource behavior for the "Source Pills" at bottom.
    // Or upgrade them? Implementation plan focused on inline citations.
    // Let's leave Source Pills as is (open in new tab) as a fallback.
    
    if (source.canView === false) return
    try {
        const token = localStorage.getItem('auth_token')
        const url = `/api/knowledge/${source.id}/view?token=${token}`
        window.open(url, '_blank')
    } catch (e) {
        console.error('Failed to open source:', e)
    }
}

const getFileIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase()
    if (['pdf'].includes(ext)) return { icon: '📄', color: '#ef4444', label: 'PDF' }
    if (['doc', 'docx'].includes(ext)) return { icon: '📝', color: '#3b82f6', label: 'Word' }
    if (['xls', 'xlsx', 'csv'].includes(ext)) return { icon: '📊', color: '#10b981', label: 'Sheet' }
    if (['ppt', 'pptx'].includes(ext)) return { icon: '🎬', color: '#f59e0b', label: 'Slide' }
    return { icon: '📎', color: '#6b7280', label: 'File' }
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
                    <span class="file-name" :title="file.name">{{ file.name }}</span>
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
          
          <div ref="messageRef" class="prose-content prose" v-if="message.content" v-html="render(message.content)"></div>
          
          <!-- Typing Indicator / Status (Dynamic) -->
          <div v-if="!message.content || (message.status && message.status !== '')" class="typing-indicator">
            <div class="dots" v-if="!message.content">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span class="text animate-flicker">{{ message.status || t('thinking') }}</span>
          </div>
          
          <!-- RAG Source Container -->
          <div v-if="message.meta?.usedRAG" class="sources-container">
            <span class="sources-label">{{ t('sources') || 'Sources:' }}</span>
            <div class="sources-list">
              <div 
                v-for="source in message.meta.sources" 
                :key="typeof source === 'object' ? source.id : source"
                class="source-pill"
                @click="openSource(source)"
                :class="{ 
                    'clickable': typeof source === 'object' && source.canView !== false,
                    'restricted': typeof source === 'object' && source.canView === false
                }"
                :style="typeof source === 'object' && source.canView !== false ? { borderColor: getFileIcon(source.name).color + '40' } : {}"
              >
                <span class="source-icon" :style="typeof source === 'object' && source.canView !== false ? { color: getFileIcon(source.name).color } : { color: '#9ca3af' }">
                    {{ getFileIcon(typeof source === 'object' ? source.name : source).icon }}
                </span>
                <span class="source-name">{{ typeof source === 'object' ? source.name : source }}</span>
                <span v-if="typeof source === 'object' && source.canView === false" class="lock-icon" title="Restricted Access">🔒</span>
              </div>
              <!-- Fallback if sources list is empty but usedRAG is true -->
              <div v-if="!message.meta.sources?.length" class="source-pill plain">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
                <span>{{ t('answeredFromKnowledgeBase') || 'Knowledge Base' }}</span>
              </div>
            </div>
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

/* Citation Token Styles - Global because v-html injects them */
:global(.citation-token) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-secondary);
    color: var(--color-primary);
    font-size: 11px;
    font-weight: 600;
    min-width: 18px;
    height: 18px;
    border-radius: 4px;
    margin: 0 2px;
    cursor: pointer;
    user-select: none;
    transition: all 0.2s;
    vertical-align: super;
}

:global(.citation-token.valid:hover) {
    background: var(--color-primary);
    color: white;
}

:global(.citation-token.invalid) {
    color: var(--color-text-muted);
    cursor: not-allowed;
    background: #f3f4f6;
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

.sources-container {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.sources-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.sources-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.source-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 20px; /* Fully rounded */
    font-size: 12px;
    color: var(--color-text-primary);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    max-width: 240px;
    cursor: default;
}

.source-pill.clickable {
    cursor: pointer;
}

.source-pill.clickable:hover {
    border-color: var(--color-primary);
    background: var(--color-bg-tertiary);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
}

.source-pill.plain {
    color: var(--color-text-muted);
    font-style: italic;
}

.source-icon {
    font-size: 14px;
    line-height: 1;
}

.source-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
}

.source-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    padding: 4px 10px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    font-size: 11px;
    color: var(--color-text-muted);
    transition: all 0.2s;
}

.source-badge:hover {
    border-color: var(--color-primary);
    color: var(--color-text-secondary);
}

.source-badge svg {
    color: var(--color-primary);
}

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
    max-width: 200px;
}

.msg-file .file-icon {
    color: var(--color-text-muted);
}

.msg-file .file-name {
    font-size: 13px;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
</style>
