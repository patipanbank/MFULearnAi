<script setup>
/**
 * Chat View - Final Layout
 * - Sidebar: New Chat + Search, Collapsible (width:0)
 * - Header: Title Left, User Dropdown Right
 * - Context Bar: Select Knowledge Base
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useTheme, useLanguage } from '@/composables/useSettings'
import { useScrollToBottom } from '@/composables/useUtils'
import PDFViewer from '@/components/common/PDFViewer.vue'

import {
  ChatMessage,
  ChatInput,
  ChatWelcome,
  ChatTypingIndicator
} from '@/components/chat'

// Router & Stores
const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()
const knowledgeStore = useKnowledgeStore()

// Settings
const { isDark, toggle: toggleTheme, init: initTheme } = useTheme()
const { lang, toggle: toggleLang, t, init: initLang } = useLanguage()

// Refs
const messagesRef = ref(null)
const inputRef = ref(null)
const showSidebar = ref(true)
const inputMessage = ref('')
const attachments = ref([])
const isProcessingFile = ref(false)

// Evidence Viewer State
const activeEvidence = ref(null) // { src, page, highlightRect, fileName }
const showEvidenceViewer = ref(false)

// Environment
const envName = import.meta.env.VITE_ENV_NAME || 'MFULearnAI'

// Composables
const { scrollToBottom } = useScrollToBottom(messagesRef)
const route = useRoute()

// Computeds
const userInitial = computed(() => 
  authStore.displayName?.charAt(0)?.toUpperCase() || 'U'
)
const userName = computed(() => authStore.displayName || 'Guest')

// Lifecycle
onMounted(async () => {
  initTheme()
  initLang()
  
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }
  
  await chatStore.fetchModels()
  await chatStore.loadSessions()

  // Load session from URL if present
  if (route.params.sessionId) {
    chatStore.loadSession(route.params.sessionId)
  }
})

// Watchers
watch(() => route.params.sessionId, (newId) => {
  if (newId) {
    if (chatStore.currentSessionId !== newId) {
       chatStore.loadSession(newId)
    }
  } else {
    chatStore.resetSession()
  }
})

watch(() => chatStore.messages.length, () => scrollToBottom())
watch(() => chatStore.messages[chatStore.messages.length - 1]?.content, () => scrollToBottom())

// Methods
const handleNewChat = () => {
  chatStore.newSession()
  router.push('/chat')
  inputRef.value?.focus()
}

const handleSelectSession = (sessionId) => {
  router.push(`/chat/${sessionId}`)
}

const handleSendMessage = async (message) => {
  if (!message?.trim() && attachments.value.length === 0) return

  const isNewSession = !chatStore.currentSessionId

  // Separate images (base64) and files (raw File objects)
  const imagesToSend = []
  const filesToSend = []

  for (const att of attachments.value) {
    if (att.type === 'image') {
        imagesToSend.push({
            data: att.data.split(',')[1], // Remove data:... prefix
            mediaType: att.mediaType
        })
    } else if (att.type === 'doc') {
        filesToSend.push(att.rawFile) // Pass raw File object
    }
  }

  // Clear attachments immediately so UI resets
  attachments.value = []

  // Send to store
  await chatStore.sendMessage(message || '', null, imagesToSend, filesToSend)
  
  // If it was a new session, update URL so refresh works
  if (isNewSession && chatStore.currentSessionId) {
    router.replace(`/chat/${chatStore.currentSessionId}`)
  }
  
  inputRef.value?.focus()
}

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

const handleFileUpload = async (files) => {
  isProcessingFile.value = true
  try {
    for (const file of files) {
        // Image → base64 for preview + sending
        if (file.type.startsWith('image/')) {
            const reader = new FileReader()
            reader.onload = (e) => {
                attachments.value.push({
                    type: 'image',
                    name: file.name,
                    data: e.target.result,
                    mediaType: file.type
                })
            }
            reader.readAsDataURL(file)
        } 
        // Document → keep raw File, backend will parse via busboy
        else {
            attachments.value.push({
                type: 'doc',
                name: file.name,
                size: file.size,
                mediaType: file.type,
                rawFile: file  // Keep raw File for FormData upload
            })
        }
    }
  } catch (e) {
    console.error('File processing failed:', e)
  } finally {
    isProcessingFile.value = false
  }
}

const handleRemoveAttachment = (index) => {
    attachments.value.splice(index, 1)
}

const handleCopyMessage = (content) => {
  console.log('Copied message')
}

const handleViewEvidence = (evidence) => {
    // Evidence object: { id, fileName, page, bbox }
    // Construct view URL
    // We assume backend has /api/knowledge/:id/view
    // BUT wait, evidence.id in manifest is BLOCK ID (e.g. f1_b3).
    // We need FILE ID.
    // The manifest has 'fileId' if we added it in backend?
    // Let's check knowledgeService/AgentWorkflow.
    // AgentWorkflow pushes: id, fileName, page, bbox.
    // IT DOES NOT PUSH FILE ID (knowledgeId).
    // CRITICAL FIX: Backend must expose fileId in manifest.
    
    // HOWEVER, in search results, we have `block.metadata.fileId`. 
    // In local file parses, we have... we might not have a permanent ID if it's just an attachment.
    // If it's an attachment, we can't "view" it via API unless we uploaded it to knowledge store.
    // BUT the prompt says "PDF Viewer... Open Viewer... Navigate to Page".
    // If usage is "Attached Files", they are transient?
    // Architecture says: "Upload -> Parse -> Assign IDs"
    // Usually these are just in-memory for the session?
    // If so, we can't fetch them via URL unless we have a blob URL or persistent ID.
    
    // Assumption: For this phase, we assume the backend returns a `fileId` that is valid for `/api/knowledge/:id/view`.
    // If not, we might fail to load.
    // Let's check `AgentWorkflow.ts` manifest population again.
    // It pushes `fileName`.
    // It pushed `fileId`? NO.
    
    // BACKEND GAPS: 
    // 1. `AgentWorkflow.ts` needs to push `fileId` to manifest.
    // 2. `IRBlock` needs `fileId`.
    
    // Start of Selection
    // Wait, I fixed `IRBlock` in `shared/types.ts` to have `fileId`.
    // But did I update `AgentWorkflow.ts` to push it?
    // Viewing `AgentWorkflow.ts` earlier showed:
    /*
    injectedEvidence.push({
        id: block.id,
        fileName: fileName,
        page: block.metadata?.page,
        bbox: block.metadata?.bbox
    });
    */
    // It is MISSING fileId.
    
    // I can't fix backend in this turn if I am in frontend mode?
    // Actually I can edit backend files.
    // I should fix this gap to allow viewing.
    
    // For now, let's implement the frontend handler assuming `evidence.fileId` will exist,
    // and I will add a task to fix the backend gap.
    
    // Construct URL
    const token = localStorage.getItem('auth_token')
    // Fallback? If no fileId, can't view.
    if (!evidence.fileId) {
        console.error("Evidence missing fileId", evidence)
        return
    }
    
    activeEvidence.value = {
        src: `/api/knowledge/${evidence.fileId}/view?token=${token}`,
        page: evidence.page,
        highlightRect: evidence.bbox,
        fileName: evidence.fileName
    }
    showEvidenceViewer.value = true
}

const closeEvidenceViewer = () => {
    showEvidenceViewer.value = false
    activeEvidence.value = null
}
</script>

<template>
  <div class="chat-layout">
    <!-- Main Content -->
    <main class="chat-main">
      
      <!-- Context Bar Removed (Moved to Header) -->
      
      <!-- Chat Area -->
      <div class="messages-area" ref="messagesRef">
        <ChatWelcome
          v-if="chatStore.messages.length === 0"
          :user-name="userName"
          :env-name="envName"
          :t="t"
        />
        
        <div v-else class="messages-list">
          <TransitionGroup name="fade-slide">
            <ChatMessage
              v-for="(msg, idx) in chatStore.messages"
              :key="idx"
              :message="msg"
              :user-initial="userInitial"
              :user-avatar-url="authStore.profilePicture"
              :t="t"
              @copy="handleCopyMessage"
            />
          </TransitionGroup>
          
        </div>
      </div>
      
      <!-- Mode Toggle REMOVED -->

      <!-- Input Area -->
      <ChatInput
        ref="inputRef"
        v-model="inputMessage"
        :attachments="attachments"
        :disabled="chatStore.isStreaming"
        :loading="chatStore.isStreaming || isProcessingFile"
        :t="t"
        @send="handleSendMessage"
        @upload="handleFileUpload"
        @remove-attachment="handleRemoveAttachment"
      />
    </main>

    <!-- PDF Viewer Modal -->
    <PDFViewer
        v-if="showEvidenceViewer"
        :is-open="showEvidenceViewer"
        :src="activeEvidence?.src"
        :page="activeEvidence?.page"
        :highlight-rect="activeEvidence?.highlightRect"
        :file-name="activeEvidence?.fileName"
        @close="closeEvidenceViewer"
    />
  </div>
</template>

<style scoped>
.chat-layout {
  display: flex;
  height: 100%;
  background: var(--color-bg-primary);
  overflow: hidden;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0; /* Prevents flex items from overflowing */
  background: var(--color-bg-primary);
  position: relative;
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.messages-list {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

/* Transitions */
.fade-slide-enter-active {
  animation: fadeSlide 0.3s ease-out;
}

@keyframes fadeSlide {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .messages-list {
    padding: 16px;
  }
}


</style>
