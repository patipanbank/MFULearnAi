<script setup>
/**
 * Chat View - Final Layout
 * - Sidebar: New Chat + Search, Collapsible (width:0)
 * - Header: Title Left, User Dropdown Right
 * - Context Bar: Select Knowledge Base
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useKnowledgeStore } from '@/stores/knowledge'

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

// Environment
const envName = import.meta.env.VITE_ENV_NAME || 'MFULearnAI'

// Composables
const { scrollToBottom } = useScrollToBottom(messagesRef)

// Computeds
const userInitial = computed(() => 
  authStore.displayName?.charAt(0)?.toUpperCase() || 'U'
)
const userName = computed(() => authStore.displayName || 'Guest')

// Lifecycle
onMounted(() => {
  initTheme()
  initLang()
  
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }
  
  // if (!chatStore.currentSessionId) {
  //   chatStore.newSession()
  // }
  
  chatStore.fetchModels()
  chatStore.loadSessions()
  chatStore.fetchModels()
  chatStore.loadSessions()
})

// Watchers
watch(() => chatStore.messages.length, () => scrollToBottom())
watch(() => chatStore.messages[chatStore.messages.length - 1]?.content, () => scrollToBottom())

// Methods
const handleNewChat = () => {
  chatStore.newSession()
  inputRef.value?.focus()
}

const handleSelectSession = (sessionId) => {
  chatStore.loadSession(sessionId)
}

const handleSendMessage = async (message) => {
  if (!message?.trim() && attachments.value.length === 0) return

  // Prepare payload
  let finalMessage = message || ''
  const imagesToSend = []

  // Process attachments
  // 1. Append Text/PDF content to message
  // 2. Collect Images
  for (const file of attachments.value) {
    if (file.type === 'doc') {
        finalMessage += `\n\n[Context from ${file.name}]:\n${file.content}`
    } else if (file.type === 'image') {
        imagesToSend.push({
            data: file.data.split(',')[1], // Remove prefix
            mediaType: file.mediaType
        })
    }
  }

  // Clear attachments immediately so UI resets
  attachments.value = []

  await chatStore.sendMessage(finalMessage, null, imagesToSend)
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
        // Image
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
        // Document (PDF/Text)
        else {
            const text = await knowledgeStore.extractText(file)
            attachments.value.push({
                type: 'doc',
                name: file.name,
                content: text
            })
        }
    }
  } catch (e) {
    console.error('File processing failed:', e)
    // Could show a toast/error here
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
