<script setup>
import { useMarkdown } from '@/composables/useMarkdown'
import { ref } from 'vue'

const props = defineProps({
  message: { type: Object, required: true },
  userInitial: { type: String, default: 'U' },
  userAvatarUrl: { type: String, default: '' },
  t: { type: Function, required: true }
})

const emit = defineEmits(['copy'])

const { render, copyToClipboard } = useMarkdown()
const copied = ref(false)
const viewingImage = ref(null)
const messageRef = ref(null) // Reference to the message container



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

const openAttachment = (att) => {
    if (att.key) {
        // Use secure proxy endpoint (persistent)
        // Ensure we handle the path correctly.
        // The API is likely hosted at /api relative to frontend or configured base.
        // If frontend has axios base URL, we might need that. 
        // But usually relative /api works if proxied.
        // We'll use a relative path assuming same domain or proxy.
        // If att.key starts with slash, remove it. (It shouldn't)
        const url = `/api/chat/attachment/${att.key}`;
        window.open(url, '_blank');
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
                    <span class="file-name" :title="file.name">{{ file.name }}</span>
                </div>
            </div>

            <!-- Persisted Attachments (History) -->
            <div v-if="message.attachments && message.attachments.length > 0" class="message-files outside">
                <div v-for="(att, index) in message.attachments" :key="index" class="msg-file clickable" @click="openAttachment(att)" :title="att.fileName">
                    <div class="file-icon">
                         <span v-if="att.mimeType && att.mimeType.includes('image')">📷</span>
                         <span v-else-if="att.mimeType && (att.mimeType.includes('pdf') || att.fileName.endsWith('.pdf'))">📄</span>
                         <span v-else-if="att.mimeType && (att.mimeType.includes('sheet') || att.mimeType.includes('excel'))">📊</span>
                         <span v-else>📎</span>
                    </div>
                    <div class="file-info-stack">
                        <span class="file-name">{{ att.fileName }}</span>
                        <span class="file-size">{{ formatBytes(att.fileSize) }}</span>
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
          
          <div ref="messageRef" class="prose-content prose" v-if="message.content" v-html="render(message.content)"></div>
          
          <!-- File Processing Progress (Replaces typing indicator when active) -->
          <div v-if="message.fileProgress && message.fileProgress.percent < 100" class="file-progress-container">
             <div class="progress-info">
                <span class="file-name"><span class="icon">📄</span> {{ message.fileProgress.currentFile }}</span>
                <span class="percent">{{ message.fileProgress.percent }}%</span>
             </div>
             <div class="progress-bar-track">
                <div class="progress-bar-fill" :style="{ width: message.fileProgress.percent + '%' }"></div>
             </div>
             <div class="progress-detail">{{ message.fileProgress.detail }}</div>
          </div>
          
          <!-- Typing Indicator / Status (Dynamic) -->
          <div v-else-if="!message.content || (message.status && message.status !== '')" class="typing-indicator">
            <div class="dots" v-if="!message.content">
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
</style>
