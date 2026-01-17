<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useTheme, useLanguage } from '@/composables/useSettings'

// Core
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const chatStore = useChatStore()

// Settings
const { isDark, toggle: toggleTheme } = useTheme()
const { lang, toggle: toggleLang, t } = useLanguage()

// State
const isCollapsed = ref(false)

// Navigation Configuration
const mainNav = [
  { id: 'chat', label: 'AI Chat', path: '/chat', icon: 'message-square' },
  { id: 'knowledge', label: 'Knowledge', path: '/knowledge', icon: 'book' },
  { id: 'admin', label: 'Admin', path: '/admin', icon: 'settings' }
]

// Computed
const currentRouteName = computed(() => route.name)
const userInitials = computed(() => authStore.displayName?.charAt(0)?.toUpperCase() || 'U')

// Methods
const handleNewChat = () => {
    chatStore.newSession()
    if (route.path !== '/chat') {
        router.push('/chat')
    }
}

const handleSelectSession = (sessionId) => {
    chatStore.loadSession(sessionId)
    if (route.path !== '/chat') {
        router.push('/chat')
    }
}

const handleLogout = () => {
    authStore.logout()
    router.push('/login')
}
</script>

<template>
  <aside class="app-sidebar" :class="{ 'collapsed': isCollapsed }">
    <!-- 1. Header & Logo -->
    <div class="sidebar-header">
      <div class="logo-area">
        <div class="logo-icon">M</div>
        <span class="logo-text">MFU Learn</span>
      </div>
      <button class="toggle-btn" @click="isCollapsed = !isCollapsed">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" v-if="!isCollapsed"></polyline>
          <polyline points="9 18 15 12 9 6" v-else></polyline>
        </svg>
      </button>
    </div>

    <!-- 2. Primary Action (New Chat) -->
    <div class="sidebar-action">
      <button class="new-chat-btn" @click="handleNewChat" :title="t('newChat')">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span class="btn-text">{{ t('newChat') }}</span>
      </button>
    </div>

    <!-- 3. Main Navigation -->
    <nav class="main-nav">
      <div class="nav-label" v-if="!isCollapsed">MENU</div>
      <router-link 
        v-for="item in mainNav" 
        :key="item.id"
        :to="item.path"
        class="nav-item"
        :class="{ 'active': route.path.startsWith(item.path) }"
      >
        <div class="nav-icon-wrapper">
          <!-- Chat Icon -->
          <svg v-if="item.icon === 'message-square'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <!-- Book Icon -->
          <svg v-if="item.icon === 'book'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          <!-- Settings Icon -->
          <svg v-if="item.icon === 'settings'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </div>
        <span class="nav-text">{{ item.label }}</span>
      </router-link>
    </nav>

    <!-- 4. Contextual Content (Scrollable) -->
    <div class="sidebar-content">
      <!-- Chat History -->
      <div v-if="route.path.startsWith('/chat') && !isCollapsed" class="context-section">
        <div class="section-label">{{ t('recentChats') }}</div>
        <div class="session-list">
          <button 
            v-for="session in chatStore.sessions" 
            :key="session.sessionId"
            class="session-item"
            :class="{ 'active': session.sessionId === chatStore.currentSessionId }"
            @click="handleSelectSession(session.sessionId)"
          >
            <svg class="session-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span class="session-text">{{ session.metadata?.title || 'New Conversation' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 5. Footer (User & System) -->
    <div class="sidebar-footer">
      <div class="user-profile" v-if="!isCollapsed">
        <div class="avatar">{{ userInitials }}</div>
        <div class="user-info">
          <div class="user-name">{{ authStore.displayName }}</div>
          <div class="user-role">User</div>
        </div>
      </div>
      
      <div class="footer-actions">
        <button class="footer-btn" @click="toggleTheme" :title="isDark ? 'Light Mode' : 'Dark Mode'">
           <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
           <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        </button>
        <button class="footer-btn" @click="toggleLang" :title="lang">
            <span class="lang-text">{{ lang === 'th' ? 'EN' : 'TH' }}</span>
        </button>
        <button class="footer-btn logout" @click="handleLogout" title="Sign Out">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* Base Layout */
.app-sidebar {
  display: flex;
  flex-direction: column;
  width: 260px;
  height: 100%;
  background-color: #0f172a; /* Slate 900 */
  border-right: 1px solid #1e293b; /* Slate 800 */
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  color: #94a3b8; /* Slate 400 */
  z-index: 50;
}

.app-sidebar.collapsed {
  width: 72px;
}

/* 1. Header */
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  height: 64px;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  white-space: nowrap;
}

.logo-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  border-radius: 8px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  flex-shrink: 0;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
}

.toggle-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.toggle-btn:hover {
  color: #f1f5f9;
  background-color: rgba(255,255,255,0.05);
}

.collapsed .logo-text, 
.collapsed .toggle-btn {
  display: none;
}
.collapsed .sidebar-header {
  justify-content: center;
  padding: 16px 0;
}

/* 2. Action Button */
.sidebar-action {
  padding: 0 16px 16px;
}

.new-chat-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: linear-gradient(to right, #2563eb, #3b82f6);
  color: white;
  border: none;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.new-chat-btn:hover {
  filter: brightness(110%);
  transform: translateY(-1px);
}

.collapsed .btn-text {
  display: none;
}
.collapsed .new-chat-btn {
  padding: 10px 0;
}

/* 3. Main Navigation */
.main-nav {
  padding: 0 12px;
}

.nav-label {
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  padding: 0 12px;
  margin-bottom: 8px;
  letter-spacing: 0.05em;
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
  margin-bottom: 2px;
}

.nav-item:hover {
  background-color: rgba(30, 41, 59, 0.5); /* Slate 800/50 */
  color: #f1f5f9;
}

.nav-item.active {
  background-color: rgba(59, 130, 246, 0.1); /* Blue 500/10 */
  color: #60a5fa; /* Blue 400 */
}

.nav-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px; 
}

.collapsed .nav-text {
  display: none;
}
.collapsed .nav-item {
  justify-content: center;
  padding: 10px 0;
}

/* 4. Content Area (Scrollable) */
.sidebar-content {
  flex: 1;
  overflow-y: auto;
  margin-top: 16px;
  padding: 0 12px;
  /* Scrollbar Styling */
  scrollbar-width: thin;
  scrollbar-color: #334155 transparent;
}

.sidebar-content::-webkit-scrollbar {
  width: 4px;
}
.sidebar-content::-webkit-scrollbar-thumb {
  background-color: #334155;
  border-radius: 4px;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  padding: 8px 12px 4px;
  text-transform: uppercase;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  text-align: left;
  color: #94a3b8;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.session-item:hover {
  background-color: rgba(30, 41, 59, 0.5);
  color: #f1f5f9;
}

.session-item.active {
  color: #60a5fa;
  background-color: rgba(59, 130, 246, 0.05);
}

.session-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 5. Footer */
.sidebar-footer {
  border-top: 1px solid #1e293b;
  padding: 16px;
  background-color: #0b1121;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.avatar {
  width: 36px;
  height: 36px;
  background-color: #475569;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.user-info {
  overflow: hidden;
}

.user-name {
  color: #f1f5f9;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  color: #64748b;
  font-size: 12px;
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.footer-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
}

.footer-btn:hover {
  background: #334155;
  color: white;
}

.footer-btn.logout:hover {
  background: #ef4444;
  border-color: #ef4444;
  color: white;
}

.lang-text {
  font-size: 12px;
  font-weight: 700;
}

.collapsed .footer-actions {
  flex-direction: column;
}
</style>
