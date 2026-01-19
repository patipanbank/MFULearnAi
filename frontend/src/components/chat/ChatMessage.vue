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

</style>
