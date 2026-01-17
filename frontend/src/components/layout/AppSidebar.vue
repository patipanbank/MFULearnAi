<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useSettings'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { isDark, toggle: toggleTheme } = useTheme()
const { t } = useLanguage()

import { useChatStore } from '@/stores/chat'
import ChatSidebar from '@/components/chat/ChatSidebar.vue'
import { useLanguage } from '@/composables/useSettings'

const chatStore = useChatStore()

const handleNewChat = () => {
  chatStore.newSession()
}

const handleSelectSession = (sessionId) => {
    chatStore.loadSession(sessionId)
}

const isCollapsed = ref(false)

const navigation = [
  { name: 'AI Chat', href: '/chat', icon: 'chat' },
  { name: 'Knowledge', href: '/knowledge', icon: 'book' },
  { name: 'Admin', href: '/admin', icon: 'settings' },
]

const isActive = (href) => route.path.startsWith(href)

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="sidebar-header">
      <div class="logo">
        <div class="logo-icon">M</div>
        <span v-if="!isCollapsed" class="logo-text">MFULearn AI</span>
      </div>
      <button class="toggle-btn" @click="isCollapsed = !isCollapsed">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path v-if="isCollapsed" d="M9 18l6-6-6-6"/>
          <path v-else d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
    </div>

    <!-- Navigation -->
    <nav class="sidebar-nav">
      <router-link 
        v-for="item in navigation" 
        :key="item.name"
        :to="item.href"
        class="nav-item"
        :class="{ active: isActive(item.href) }"
      >
        <!-- Chat Icon -->
        <svg v-if="item.icon === 'chat'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <!-- Book Icon -->
        <svg v-if="item.icon === 'book'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <!-- Settings Icon -->
        <svg v-if="item.icon === 'settings'" class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span v-if="!isCollapsed" class="nav-text">{{ item.name }}</span>
      </router-link>
    </nav>

    <!-- Chat History (Only visible on Chat route) -->
    <div v-if="route.path.startsWith('/chat') && !isCollapsed" class="sidebar-chat-history">
      <ChatSidebar 
        :sessions="chatStore.sessions"
        :current-session-id="chatStore.currentSessionId"
        :t="t"
        @new-chat="handleNewChat"
        @select-session="handleSelectSession"
      />
    </div>

    <!-- Footer -->
    <div class="sidebar-footer">
      <button class="footer-btn" @click="toggleTheme">
        <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle v-if="isDark" cx="12" cy="12" r="5"/>
          <line v-if="isDark" x1="12" y1="1" x2="12" y2="3"/>
          <line v-if="isDark" x1="12" y1="21" x2="12" y2="23"/>
          <line v-if="isDark" x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line v-if="isDark" x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line v-if="isDark" x1="1" y1="12" x2="3" y2="12"/>
          <line v-if="isDark" x1="21" y1="12" x2="23" y2="12"/>
          <line v-if="isDark" x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line v-if="isDark" x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          <path v-else d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
        <span v-if="!isCollapsed">{{ isDark ? 'Light' : 'Dark' }}</span>
      </button>
      <button class="footer-btn logout" @click="handleLogout">
        <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        <span v-if="!isCollapsed">Sign Out</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 240px;
  height: 100%;
  background: #0b1121;
  border-right: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
  flex-shrink: 0;
}

.sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #1e293b;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
}

.logo-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 18px;
  flex-shrink: 0;
}

.logo-text {
  font-weight: 600;
  color: #f1f5f9;
  white-space: nowrap;
}

.toggle-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.toggle-btn:hover {
  background: #1e293b;
  color: #f1f5f9;
}

.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  overflow-y: auto;
  flex-shrink: 0;
  max-height: 40%;
}

.sidebar-chat-history {
  flex: 1;
  overflow-y: auto;
  border-top: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  color: #94a3b8;
  text-decoration: none;
  transition: all 0.15s;
  margin-bottom: 4px;
}

.nav-item:hover {
  background: #1e293b;
  color: #f1f5f9;
}

.nav-item.active {
  background: #3b82f6;
  color: white;
}

.nav-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.nav-text {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.sidebar-footer {
  padding: 12px 8px;
  border-top: 1px solid #1e293b;
}

.footer-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 4px;
}

.footer-btn:hover {
  background: #1e293b;
  color: #f1f5f9;
}

.footer-btn.logout:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
}

.collapsed .logo-text,
.collapsed .nav-text,
.collapsed .footer-btn span {
  display: none;
}

.collapsed .toggle-btn {
  display: none;
}
</style>
