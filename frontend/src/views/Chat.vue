<script setup>
/**
 * Chat View - Main chat interface
 * Composes smaller components following Vue best practices:
 * - Single Responsibility: Each component handles one concern
 * - Props Down / Events Up: Clear data flow
 * - Composables for shared logic
 * - Scoped styles in components
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useScrollToBottom } from '@/composables/useUtils'

// Import components
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

// Refs
const messagesRef = ref(null)
const inputRef = ref(null)
const showSidebar = ref(true)
const inputMessage = ref('')

// Environment
const envName = import.meta.env.VITE_ENV_NAME || 'MFULearnAI'
const envType = import.meta.env.VITE_ENV_TYPE || 'TEST'

// Composables
const { scrollToBottom } = useScrollToBottom(messagesRef)

// Computed
const userInitial = computed(() => 
  authStore.displayName?.charAt(0)?.toUpperCase() || 'U'
)

// Lifecycle
onMounted(() => {
  // Auth check
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }
  
  // Initialize session
  if (!chatStore.currentSessionId) {
    chatStore.newSession()
  }
  
  // Load history
  chatStore.loadSessions()
})

// Watchers - Auto scroll on new messages
watch(
  () => chatStore.messages.length,
  () => scrollToBottom()
)

watch(
  () => chatStore.messages[chatStore.messages.length - 1]?.content,
  () => scrollToBottom()
)

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

const handleSelectPrompt = (promptText) => {
  handleSendMessage(promptText)
}

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

const handleCopyMessage = (content) => {
  // Optional: Show toast notification
  console.log('Copied:', content.substring(0, 50) + '...')
}
</script>

<template>
  <div class="chat-app" :data-theme="envType === 'PROD' ? 'dindin' : ''">
    <!-- Animated Background -->
    <div class="bg-effects">
      <div class="gradient-orb orb-1"></div>
      <div class="gradient-orb orb-2"></div>
      <div class="gradient-orb orb-3"></div>
    </div>

    <!-- Sidebar Component -->
    <ChatSidebar
      v-model="showSidebar"
      :sessions="chatStore.sessions"
      :current-session-id="chatStore.currentSessionId"
      :env-name="envName"
      :env-type="envType"
      @new-chat="handleNewChat"
      @select-session="handleSelectSession"
      @logout="handleLogout"
    />
    
    <!-- Main Chat Area -->
    <main class="chat-main">
      <!-- Header Component -->
      <ChatHeader
        :env-name="envName"
        model-name="Claude 3.5"
        @toggle-sidebar="showSidebar = !showSidebar"
      />
      
      <!-- Messages Container -->
      <div class="messages-wrapper" ref="messagesRef">
        <!-- Welcome Screen (Empty State) -->
        <ChatWelcome
          v-if="chatStore.messages.length === 0"
          :user-name="authStore.user?.firstName"
          :env-name="envName"
          @select-prompt="handleSelectPrompt"
        />
        
        <!-- Messages List -->
        <div v-else class="messages-list">
          <TransitionGroup name="message">
            <ChatMessage
              v-for="(msg, idx) in chatStore.messages"
              :key="idx"
              :message="msg"
              :user-initial="userInitial"
              @copy="handleCopyMessage"
            />
          </TransitionGroup>
          
          <!-- Typing Indicator -->
          <ChatTypingIndicator v-if="chatStore.isStreaming" />
        </div>
      </div>
      
      <!-- Input Component -->
      <ChatInput
        ref="inputRef"
        v-model="inputMessage"
        :disabled="chatStore.isStreaming"
        :loading="chatStore.isStreaming"
        @send="handleSendMessage"
      />
    </main>
  </div>
</template>

<style scoped>
/* === Layout Variables === */
.chat-app {
  --sidebar-width: 300px;
  --header-height: 64px;
  --glass-bg: rgba(30, 41, 59, 0.8);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glow-primary: rgba(59, 130, 246, 0.5);
  --glow-accent: rgba(139, 92, 246, 0.5);
  
  display: flex;
  height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
  position: relative;
  overflow: hidden;
}

/* DinDin Theme */
.chat-app[data-theme="dindin"] {
  --glow-primary: rgba(5, 150, 105, 0.5);
  --glow-accent: rgba(16, 185, 129, 0.5);
  background: linear-gradient(135deg, #111827 0%, #064e3b 50%, #111827 100%);
}

/* === Background Effects === */
.bg-effects {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  animation: float 20s ease-in-out infinite;
}

.orb-1 {
  width: 600px;
  height: 600px;
  background: var(--color-primary);
  top: -200px;
  right: -100px;
}

.orb-2 {
  width: 400px;
  height: 400px;
  background: var(--color-accent);
  bottom: -100px;
  left: -100px;
  animation-delay: -7s;
}

.orb-3 {
  width: 300px;
  height: 300px;
  background: var(--color-primary);
  top: 40%;
  left: 30%;
  animation-delay: -14s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -30px) scale(1.05); }
  66% { transform: translate(-20px, 20px) scale(0.95); }
}

/* === Glass Effect === */
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
}

.glass-light {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* === Main Layout === */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 10;
  min-width: 0;
}

.messages-wrapper {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.messages-list {
  padding: 24px;
  min-height: 100%;
}

/* === Transitions === */
.message-enter-active {
  animation: slide-up 0.3s ease-out;
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* === Responsive === */
@media (max-width: 768px) {
  .chat-app {
    --sidebar-width: 280px;
  }
}
</style>
