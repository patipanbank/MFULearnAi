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
import { useChatStore } from '@/stores/chat'
import { useTheme, useLanguage } from '@/composables/useSettings'
import { useScrollToBottom } from '@/composables/useUtils'

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

// Settings
const { isDark, toggle: toggleTheme, init: initTheme } = useTheme()
const { lang, toggle: toggleLang, t, init: initLang } = useLanguage()

// Refs
const messagesRef = ref(null)
const inputRef = ref(null)
const showSidebar = ref(true)
const inputMessage = ref('')
const collections = ref([])

// Environment
const envName = import.meta.env.VITE_ENV_NAME || 'MFULearnAI'

// Composables
const { scrollToBottom } = useScrollToBottom(messagesRef)

// Computeds
const userInitial = computed(() => 
  authStore.displayName?.charAt(0)?.toUpperCase() || 'U'
)
const userName = computed(() => authStore.displayName || 'Guest')

const fetchCollections = async () => {
    try {
        const res = await axios.get('/api/knowledge/collections')
        collections.value = res.data.collections
    } catch (err) {
        console.error('Failed to load collections', err)
    }
}

// Lifecycle
onMounted(() => {
  initTheme()
  initLang()
  
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }
  
  if (!chatStore.currentSessionId) {
    chatStore.newSession()
  }
  
  chatStore.fetchModels()
  chatStore.loadSessions()
  fetchCollections()
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
  if (!message?.trim()) return
  await chatStore.sendMessage(message)
  inputRef.value?.focus()
}

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

const handleFileUpload = (files) => {
  console.log('Files to upload:', files)
}

const handleCopyMessage = (content) => {
  console.log('Copied message')
}
</script>

<template>
  <div class="chat-layout">
    <!-- Main Content -->
    <main class="chat-main">
      
      <!-- Context Bar -->
      <div v-if="collections.length > 0" class="px-6 py-2 bg-slate-900 border-b border-slate-700/50 flex items-center gap-3">
        <span class="text-xs font-medium text-blue-400 uppercase tracking-wider">{{ t('activeKnowledge') }}</span>
        <select 
            v-model="chatStore.currentCollectionId" 
            class="bg-slate-800 text-gray-200 text-sm rounded-lg border border-slate-700 px-3 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
            <option :value="null">{{ t('defaultCollection') }}</option>
            <option v-for="col in collections" :key="col._id" :value="col._id">
                {{ col.name }}
            </option>
        </select>
      </div>
      
      <!-- Chat Area -->
      <div class="messages-area" ref="messagesRef">
        <ChatWelcome
          v-if="chatStore.messages.length === 0"
          :user-name="authStore.user?.firstName"
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
        :disabled="chatStore.isStreaming"
        :loading="chatStore.isStreaming"
        :t="t"
        @send="handleSendMessage"
        @upload="handleFileUpload"
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
