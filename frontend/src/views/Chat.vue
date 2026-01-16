<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'
import { marked } from 'marked'
import hljs from 'highlight.js'

const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()

const inputMessage = ref('')
const messagesContainer = ref(null)
const showSidebar = ref(true)
const inputRef = ref(null)

const envName = import.meta.env.VITE_ENV_NAME || 'MFULearnAI'
const envType = import.meta.env.VITE_ENV_TYPE || 'TEST'

// Configure marked for syntax highlighting
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  },
  breaks: true,
  gfm: true
})

// Suggested prompts for empty state
const suggestedPrompts = [
  { icon: '📚', text: 'อธิบายหลักสูตรของมหาวิทยาลัยแม่ฟ้าหลวง' },
  { icon: '💡', text: 'แนะนำวิธีการเรียนที่มีประสิทธิภาพ' },
  { icon: '🔬', text: 'ช่วยอธิบายหลักการทำงานของ AI' },
  { icon: '📝', text: 'ช่วยเขียนโค้ด Python สำหรับ...' }
]

// Check auth on mount
onMounted(() => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }
  
  if (!chatStore.currentSessionId) {
    chatStore.newSession()
  }
  
  chatStore.loadSessions()
  inputRef.value?.focus()
})

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTo({
      top: messagesContainer.value.scrollHeight,
      behavior: 'smooth'
    })
  }
}

watch(() => chatStore.messages.length, scrollToBottom)
watch(() => chatStore.messages[chatStore.messages.length - 1]?.content, scrollToBottom)

const sendMessage = async (text = null) => {
  const message = text || inputMessage.value
  if (!message?.trim() || chatStore.isStreaming) return
  
  inputMessage.value = ''
  await chatStore.sendMessage(message)
  inputRef.value?.focus()
}

const handleNewChat = () => {
  chatStore.newSession()
  inputRef.value?.focus()
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

const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

const copyCode = (code) => {
  navigator.clipboard.writeText(code)
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

    <!-- Sidebar -->
    <aside class="sidebar glass" :class="{ collapsed: !showSidebar }">
      <div class="sidebar-inner">
        <!-- Header -->
        <div class="sidebar-header">
          <div class="logo-container">
            <div class="logo-glow">
              <span class="logo-emoji">🤖</span>
            </div>
            <div class="logo-text" v-if="showSidebar">
              <span class="app-name">{{ envName }}</span>
              <span class="app-badge" v-if="envType === 'TEST'">Beta</span>
            </div>
          </div>
        </div>
        
        <!-- New Chat Button -->
        <button class="btn-new-chat" @click="handleNewChat" v-if="showSidebar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span>New Chat</span>
        </button>
        
        <!-- Session History -->
        <div class="session-list" v-if="showSidebar">
          <div class="session-section">
            <span class="section-title">Recent Conversations</span>
          </div>
          
          <TransitionGroup name="session">
            <div 
              v-for="session in chatStore.sessions.slice(0, 10)" 
              :key="session.sessionId"
              class="session-item"
              :class="{ active: session.sessionId === chatStore.currentSessionId }"
              @click="handleSelectSession(session.sessionId)"
            >
              <div class="session-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
              </div>
              <div class="session-info">
                <span class="session-title">Chat {{ session.metadata?.messageCount || 0 }}</span>
                <span class="session-meta">{{ session.metadata?.messageCount || 0 }} messages</span>
              </div>
            </div>
          </TransitionGroup>
          
          <div v-if="chatStore.sessions.length === 0" class="empty-sessions">
            <span>No conversations yet</span>
          </div>
        </div>
        
        <!-- User Profile -->
        <div class="sidebar-footer" v-if="showSidebar">
          <div class="user-card glass-light">
            <div class="user-avatar-container">
              <div class="user-avatar">
                {{ authStore.displayName?.charAt(0)?.toUpperCase() || 'U' }}
              </div>
              <div class="online-indicator"></div>
            </div>
            <div class="user-details">
              <span class="user-name">{{ authStore.displayName }}</span>
              <span class="user-role">{{ authStore.user?.department || authStore.user?.role || 'User' }}</span>
            </div>
            <button class="btn-logout" @click="handleLogout" title="Logout">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
    
    <!-- Main Chat Area -->
    <main class="chat-main">
      <!-- Header -->
      <header class="chat-header glass">
        <button class="btn-toggle" @click="showSidebar = !showSidebar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        
        <div class="header-title">
          <h1>{{ envName }}</h1>
          <span class="model-badge">Claude 3.5</span>
        </div>
        
        <div class="header-actions">
          <button class="btn-icon" title="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </header>
      
      <!-- Messages Container -->
      <div class="messages-wrapper" ref="messagesContainer">
        <!-- Empty State -->
        <div v-if="chatStore.messages.length === 0" class="welcome-screen">
          <div class="welcome-content">
            <div class="welcome-icon">
              <span>👋</span>
            </div>
            <h2>สวัสดี, {{ authStore.user?.firstName || 'you' }}!</h2>
            <p>ฉันคือ AI Assistant ของ {{ envName }} พร้อมช่วยเหลือคุณ</p>
            
            <div class="suggested-prompts">
              <h3>ลองถามคำถามเหล่านี้:</h3>
              <div class="prompts-grid">
                <button 
                  v-for="(prompt, idx) in suggestedPrompts" 
                  :key="idx"
                  class="prompt-card glass-light"
                  @click="sendMessage(prompt.text)"
                >
                  <span class="prompt-icon">{{ prompt.icon }}</span>
                  <span class="prompt-text">{{ prompt.text }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Messages -->
        <div class="messages-list" v-else>
          <TransitionGroup name="message">
            <div 
              v-for="(msg, idx) in chatStore.messages" 
              :key="idx"
              class="message-row"
              :class="msg.role"
            >
              <div class="message-container">
                <!-- Avatar -->
                <div class="message-avatar" v-if="msg.role === 'assistant'">
                  <div class="avatar-ring">
                    <span>🤖</span>
                  </div>
                </div>
                
                <!-- Content -->
                <div class="message-bubble" :class="{ error: msg.error }">
                  <div 
                    v-if="msg.role === 'assistant'" 
                    class="markdown-body"
                    v-html="renderMarkdown(msg.content)"
                  ></div>
                  <div v-else class="user-text">{{ msg.content }}</div>
                  
                  <div class="message-footer">
                    <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
                    <button 
                      v-if="msg.role === 'assistant' && msg.content" 
                      class="btn-copy"
                      @click="copyCode(msg.content)"
                      title="Copy"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    </button>
                  </div>
                </div>
                
                <!-- User Avatar -->
                <div class="message-avatar user-avatar" v-if="msg.role === 'user'">
                  <div class="avatar-gradient">
                    {{ authStore.displayName?.charAt(0)?.toUpperCase() || 'U' }}
                  </div>
                </div>
              </div>
            </div>
          </TransitionGroup>
          
          <!-- Typing Indicator -->
          <div v-if="chatStore.isStreaming" class="typing-row">
            <div class="message-avatar">
              <div class="avatar-ring pulse">
                <span>🤖</span>
              </div>
            </div>
            <div class="typing-bubble">
              <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span class="typing-text">กำลังคิด...</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Input Area -->
      <div class="input-area">
        <div class="input-container glass">
          <div class="input-wrapper">
            <textarea 
              ref="inputRef"
              v-model="inputMessage"
              class="chat-input"
              placeholder="พิมพ์ข้อความของคุณ..."
              :disabled="chatStore.isStreaming"
              @keydown="handleKeydown"
              rows="1"
            ></textarea>
            
            <div class="input-actions">
              <button 
                class="btn-send"
                :class="{ active: inputMessage.trim() }"
                :disabled="chatStore.isStreaming || !inputMessage.trim()"
                @click="sendMessage()"
              >
                <svg v-if="!chatStore.isStreaming" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
                <div v-else class="spinner-small"></div>
              </button>
            </div>
          </div>
          
          <p class="input-disclaimer">
            AI อาจให้ข้อมูลที่ไม่ถูกต้อง กรุณาตรวจสอบข้อมูลสำคัญอีกครั้ง
          </p>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* === Base Variables === */
.chat-app {
  --sidebar-width: 300px;
  --header-height: 64px;
  --input-height: 140px;
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

/* DinDin Theme Override */
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
  animation-delay: 0s;
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

/* === Glass Morphism === */
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

/* === Sidebar === */
.sidebar {
  width: var(--sidebar-width);
  height: 100vh;
  position: relative;
  z-index: 20;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-right: 1px solid var(--glass-border);
}

.sidebar.collapsed {
  width: 0;
  border-right: none;
}

.sidebar-inner {
  width: var(--sidebar-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px 16px;
  overflow: hidden;
}

.sidebar-header {
  margin-bottom: 20px;
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-glow {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px var(--glow-primary);
  animation: glow-pulse 3s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 20px var(--glow-primary); }
  50% { box-shadow: 0 0 30px var(--glow-accent); }
}

.logo-emoji {
  font-size: 24px;
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.app-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
}

.app-badge {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-accent);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-new-chat {
  width: 100%;
  padding: 14px 16px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border: none;
  border-radius: 12px;
  color: white;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 15px var(--glow-primary);
}

.btn-new-chat:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px var(--glow-primary);
}

.btn-new-chat svg {
  width: 18px;
  height: 18px;
}

/* Session List */
.session-list {
  flex: 1;
  overflow-y: auto;
  margin-top: 20px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 8px;
  margin-bottom: 8px;
  display: block;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
}

.session-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.session-item.active {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.session-icon {
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.session-icon svg {
  width: 16px;
  height: 16px;
  color: var(--color-text-muted);
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-meta {
  font-size: 11px;
  color: var(--color-text-muted);
}

.empty-sessions {
  text-align: center;
  padding: 20px;
  color: var(--color-text-muted);
  font-size: 13px;
}

/* Sidebar Footer */
.sidebar-footer {
  margin-top: auto;
  padding-top: 16px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
}

.user-avatar-container {
  position: relative;
}

.user-avatar {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  color: white;
}

.online-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  background: var(--color-success);
  border: 2px solid var(--color-bg-card);
  border-radius: 50%;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  display: block;
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
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-logout:hover {
  color: var(--color-error);
  border-color: var(--color-error);
  background: rgba(239, 68, 68, 0.1);
}

.btn-logout svg {
  width: 18px;
  height: 18px;
}

/* === Main Chat === */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 10;
  min-width: 0;
}

/* Header */
.chat-header {
  height: var(--header-height);
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid var(--glass-border);
}

.btn-toggle, .btn-icon {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-toggle:hover, .btn-icon:hover {
  background: rgba(255, 255, 255, 0.1);
}

.btn-toggle svg, .btn-icon svg {
  width: 20px;
  height: 20px;
}

.header-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title h1 {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.model-badge {
  padding: 4px 10px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  color: white;
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* === Messages === */
.messages-wrapper {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
}

/* Welcome Screen */
.welcome-screen {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.welcome-content {
  text-align: center;
  max-width: 600px;
}

.welcome-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  box-shadow: 0 0 40px var(--glow-primary);
  animation: bounce-slow 3s ease-in-out infinite;
}

@keyframes bounce-slow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.welcome-content h2 {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 8px;
}

.welcome-content p {
  font-size: 16px;
  color: var(--color-text-muted);
  margin-bottom: 40px;
}

.suggested-prompts h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: 16px;
}

.prompts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.prompt-card {
  padding: 16px;
  border-radius: 12px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.prompt-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.prompt-icon {
  font-size: 24px;
  display: block;
  margin-bottom: 8px;
}

.prompt-text {
  font-size: 13px;
  color: var(--color-text);
  display: block;
  line-height: 1.4;
}

/* Messages List */
.messages-list {
  padding: 24px;
  min-height: 100%;
}

.message-row {
  margin-bottom: 24px;
}

.message-row.user {
  display: flex;
  justify-content: flex-end;
}

.message-container {
  display: flex;
  gap: 12px;
  max-width: 80%;
}

.message-row.user .message-container {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.avatar-ring {
  width: 40px;
  height: 40px;
  background: var(--glass-bg);
  border: 2px solid var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.avatar-ring.pulse {
  animation: ring-pulse 1.5s ease-in-out infinite;
}

@keyframes ring-pulse {
  0%, 100% { border-color: var(--color-primary); }
  50% { border-color: var(--color-accent); }
}

.avatar-gradient {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: white;
}

.message-bubble {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  padding: 16px;
  position: relative;
}

.message-row.user .message-bubble {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border: none;
}

.message-bubble.error {
  border-color: var(--color-error);
  background: rgba(239, 68, 68, 0.1);
}

.user-text {
  color: white;
  font-size: 15px;
  line-height: 1.6;
}

/* Markdown Styles */
.markdown-body {
  color: var(--color-text);
  font-size: 15px;
  line-height: 1.7;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
  color: var(--color-text);
}

.markdown-body :deep(p) {
  margin-bottom: 0.8em;
}

.markdown-body :deep(code) {
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 0.9em;
}

.markdown-body :deep(pre) {
  background: rgba(0, 0, 0, 0.4);
  padding: 16px;
  border-radius: 12px;
  overflow-x: auto;
  margin: 1em 0;
}

.markdown-body :deep(pre code) {
  padding: 0;
  background: none;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.markdown-body :deep(a) {
  color: var(--color-primary);
}

.message-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.message-time {
  font-size: 11px;
  color: var(--color-text-muted);
}

.message-row.user .message-time {
  color: rgba(255, 255, 255, 0.7);
}

.btn-copy {
  padding: 4px;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-copy:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.1);
}

.btn-copy svg {
  width: 14px;
  height: 14px;
}

/* Typing Indicator */
.typing-row {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.typing-bubble {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  width: 8px;
  height: 8px;
  background: var(--color-primary);
  border-radius: 50%;
  animation: typing-bounce 1.4s infinite ease-in-out both;
}

.typing-dots span:nth-child(1) { animation-delay: -0.32s; }
.typing-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.typing-text {
  font-size: 13px;
  color: var(--color-text-muted);
}

/* === Input Area === */
.input-area {
  padding: 20px;
  background: linear-gradient(to top, var(--color-bg-dark) 50%, transparent);
}

.input-container {
  max-width: 800px;
  margin: 0 auto;
  border-radius: 20px;
  padding: 16px;
}

.input-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 14px 18px;
  color: var(--color-text);
  font-size: 15px;
  resize: none;
  min-height: 48px;
  max-height: 150px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.chat-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.chat-input::placeholder {
  color: var(--color-text-muted);
}

.btn-send {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-send.active {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border: none;
  color: white;
  box-shadow: 0 4px 15px var(--glow-primary);
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-send svg {
  width: 20px;
  height: 20px;
}

.spinner-small {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.input-disclaimer {
  text-align: center;
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 12px;
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

.session-enter-active,
.session-leave-active {
  transition: all 0.3s ease;
}

.session-enter-from,
.session-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* === Responsive === */
@media (max-width: 768px) {
  .sidebar {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 100;
  }
  
  .sidebar.collapsed {
    transform: translateX(-100%);
    width: var(--sidebar-width);
  }
  
  .prompts-grid {
    grid-template-columns: 1fr;
  }
  
  .message-container {
    max-width: 95%;
  }
}
</style>
