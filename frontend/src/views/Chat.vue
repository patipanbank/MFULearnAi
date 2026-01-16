<script setup>
/**
 * Chat View - Final Layout
 * - Sidebar: New Chat + Search, Collapsible (width:0)
 * - Header: Title Left, User Dropdown Right
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useTheme, useLanguage } from '@/composables/useSettings'
import { useScrollToBottom } from '@/composables/useUtils'

import {
  ChatSidebar,
  ChatHeader,
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
  
  if (!chatStore.currentSessionId) {
    chatStore.newSession()
  }
  
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
    <!-- Sidebar -->
    <ChatSidebar
      v-model="showSidebar"
      :sessions="chatStore.sessions"
      :current-session-id="chatStore.currentSessionId"
      :t="t"
      @new-chat="handleNewChat"
      @select-session="handleSelectSession"
    />
    
    <!-- Main Content -->
    <main class="chat-main">
      <!-- Header -->
      <ChatHeader
        :env-name="envName"
        :user-name="userName"
        :user-initial="userInitial"
        :is-dark="isDark"
        :lang="lang"
        :t="t"
        @toggle-sidebar="showSidebar = !showSidebar"
        @toggle-theme="toggleTheme"
        @toggle-lang="toggleLang"
        @logout="handleLogout"
      />
      
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
          
          <ChatTypingIndicator v-if="chatStore.isStreaming" :t="t" />
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
  height: 100vh;
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
