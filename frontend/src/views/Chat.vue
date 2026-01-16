<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'
import { marked } from 'marked'

const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()

const inputMessage = ref('')
const messagesContainer = ref(null)
const showSidebar = ref(true)

const envName = import.meta.env.VITE_ENV_NAME || 'MFULearnAI'

// Check auth on mount
onMounted(() => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }
  
  // Initialize new session if none exists
  if (!chatStore.currentSessionId) {
    chatStore.newSession()
  }
  
  // Load user sessions
  chatStore.loadSessions()
})

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Watch messages for auto-scroll
watch(() => chatStore.messages.length, scrollToBottom)
watch(() => chatStore.messages[chatStore.messages.length - 1]?.content, scrollToBottom)

const sendMessage = async () => {
  if (!inputMessage.value.trim() || chatStore.isStreaming) return
  
  const message = inputMessage.value
  inputMessage.value = ''
  await chatStore.sendMessage(message)
}

const handleNewChat = () => {
  chatStore.newSession()
}

const handleSelectSession = (sessionId) => {
  chatStore.loadSession(sessionId)
}

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

const renderMarkdown = (content) => {
  return marked(content || '')
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="chat-layout">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ 'sidebar-hidden': !showSidebar }">
      <div class="sidebar-header">
        <div class="logo-small">🤖</div>
        <span class="logo-text">{{ envName }}</span>
      </div>
      
      <button class="btn-new-chat" @click="handleNewChat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        New Chat
      </button>
      
      <!-- Session History -->
      <div class="session-list">
        <div class="session-list-header">Recent Chats</div>
        <div 
          v-for="session in chatStore.sessions" 
          :key="session.sessionId"
          class="session-item"
          :class="{ active: session.sessionId === chatStore.currentSessionId }"
          @click="handleSelectSession(session.sessionId)"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" class="session-icon">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
          </svg>
          <span class="session-title">
            {{ session.metadata?.messageCount || 0 }} messages
          </span>
        </div>
      </div>
      
      <!-- User Profile -->
      <div class="sidebar-footer">
        <div class="user-profile">
          <div class="user-avatar">
            {{ authStore.displayName?.charAt(0)?.toUpperCase() || 'U' }}
          </div>
          <div class="user-info">
            <div class="user-name">{{ authStore.displayName }}</div>
            <div class="user-role">{{ authStore.user?.role || 'User' }}</div>
          </div>
        </div>
        <button class="btn-logout" @click="handleLogout" title="Logout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
    
    <!-- Main Chat Area -->
    <main class="chat-main">
      <!-- Toggle Sidebar -->
      <button class="btn-toggle-sidebar" @click="showSidebar = !showSidebar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      
      <!-- Messages Area -->
      <div class="messages-container" ref="messagesContainer">
        <!-- Empty State -->
        <div v-if="chatStore.messages.length === 0" class="empty-state">
          <div class="empty-icon">💬</div>
          <h2>Start a conversation</h2>
          <p>Ask me anything about MFU or any topic you'd like to explore!</p>
        </div>
        
        <!-- Messages -->
        <div 
          v-for="(msg, idx) in chatStore.messages" 
          :key="idx"
          class="message fade-in"
          :class="msg.role"
        >
          <div class="message-avatar" v-if="msg.role === 'assistant'">🤖</div>
          <div class="message-content">
            <div 
              v-if="msg.role === 'assistant'" 
              class="markdown-content"
              v-html="renderMarkdown(msg.content)"
            ></div>
            <div v-else>{{ msg.content }}</div>
            <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
          </div>
          <div class="message-avatar user-avatar-msg" v-if="msg.role === 'user'">
            {{ authStore.displayName?.charAt(0)?.toUpperCase() || 'U' }}
          </div>
        </div>
        
        <!-- Streaming Indicator -->
        <div v-if="chatStore.isStreaming" class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
      
      <!-- Input Area -->
      <div class="input-area">
        <form @submit.prevent="sendMessage" class="input-form">
          <input 
            v-model="inputMessage"
            type="text"
            class="chat-input"
            placeholder="Type your message..."
            :disabled="chatStore.isStreaming"
          />
          <button 
            type="submit" 
            class="btn-send"
            :disabled="chatStore.isStreaming || !inputMessage.trim()"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </form>
        <p class="input-hint">AI responses may not always be accurate. Please verify important information.</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.chat-layout {
  display: flex;
  height: 100vh;
  background: var(--color-bg-dark);
}

/* Sidebar */
.sidebar {
  width: var(--sidebar-width);
  background: var(--color-bg-card);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease, width 0.3s ease;
}

.sidebar-hidden {
  width: 0;
  transform: translateX(-100%);
  overflow: hidden;
}

.sidebar-header {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--color-border);
}

.logo-small {
  font-size: 24px;
}

.logo-text {
  font-weight: 700;
  font-size: 18px;
  color: var(--color-text);
}

.btn-new-chat {
  margin: 16px;
  padding: 12px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.btn-new-chat:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-new-chat svg {
  width: 18px;
  height: 18px;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.session-list-header {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.session-item:hover {
  background: var(--color-bg-input);
}

.session-item.active {
  background: var(--color-bg-input);
}

.session-icon {
  width: 16px;
  height: 16px;
  color: var(--color-text-muted);
}

.session-title {
  font-size: 14px;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: white;
}

.user-info {
  overflow: hidden;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: 12px;
  color: var(--color-text-muted);
}

.btn-logout {
  padding: 8px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.btn-logout:hover {
  color: var(--color-error);
  border-color: var(--color-error);
}

.btn-logout svg {
  width: 18px;
  height: 18px;
}

/* Main Chat */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.btn-toggle-sidebar {
  position: absolute;
  top: 16px;
  left: 16px;
  padding: 8px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  cursor: pointer;
  z-index: 10;
}

.btn-toggle-sidebar svg {
  width: 20px;
  height: 20px;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  padding-top: 60px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--color-text-muted);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h2 {
  color: var(--color-text);
  margin-bottom: 8px;
}

.message {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  max-width: 80%;
}

.message.user {
  margin-left: auto;
  flex-direction: row-reverse;
}

.message-avatar {
  width: 36px;
  height: 36px;
  background: var(--color-bg-input);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.user-avatar-msg {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  color: white;
  font-size: 14px;
  font-weight: 600;
}

.message-content {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 12px 16px;
  color: var(--color-text);
}

.message.user .message-content {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border: none;
  color: white;
}

.message-time {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.message.user .message-time {
  color: rgba(255, 255, 255, 0.7);
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: var(--color-bg-card);
  border-radius: 16px;
  width: fit-content;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: var(--color-text-muted);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* Input Area */
.input-area {
  padding: 20px 24px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-card);
}

.input-form {
  display: flex;
  gap: 12px;
}

.chat-input {
  flex: 1;
  padding: 14px 20px;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  color: var(--color-text);
  font-size: 15px;
  transition: border-color 0.15s;
}

.chat-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.chat-input::placeholder {
  color: var(--color-text-muted);
}

.btn-send {
  padding: 14px 20px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border: none;
  border-radius: 12px;
  color: white;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.btn-send:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-send svg {
  width: 20px;
  height: 20px;
}

.input-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: center;
}
</style>
