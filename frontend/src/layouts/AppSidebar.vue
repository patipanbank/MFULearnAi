<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useLanguage } from '@/composables/useSettings'
import SettingsMenu from './SettingsMenu.vue'

const props = defineProps({
    isMobile: { type: Boolean, default: false },
    mobileOpen: { type: Boolean, default: false }
})

const emit = defineEmits(['close-mobile'])

// Core
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const chatStore = useChatStore()

// Settings
const { t } = useLanguage()

// State
const isCollapsedInternal = ref(true)
const isHovered = ref(false)
const showSettings = ref(false)

// Computed to handle collapse state logic
const isCollapsed = computed(() => {
    if (props.isMobile) return false // Never collapse in mobile view
    return isCollapsedInternal.value
})

// Determines if the sidebar should visually appear collapsed
// It is collapsed if the user collapsed it AND isn't hovering over it
const isEffectiveCollapsed = computed(() => {
    if (props.isMobile) return false
    return isCollapsed.value && !isHovered.value
})

// Methods
const handleNewChat = () => {
    chatStore.resetSession()
    router.push('/chat')
    if (props.isMobile) emit('close-mobile')
}

const handleSelectSession = (sessionId) => {
    // We navigate to the session URL, and the Chat.vue watcher will load it
    router.push(`/chat/${sessionId}`)
    if (props.isMobile) emit('close-mobile')
}

const handleDeleteSession = async (sessionId) => {
    if (!confirm(t('confirmDeleteChat') || 'Delete this chat?')) return
    await chatStore.deleteSession(sessionId) 
    if (chatStore.currentSessionId === sessionId) {
        chatStore.resetSession()
    }
    await chatStore.loadSessions()
}
</script>

<template>
  <aside 
    class="app-sidebar" 
    :class="{ 
        'collapsed': isEffectiveCollapsed,
        'mobile': isMobile,
        'mobile-open': mobileOpen
    }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- 1. Header & Logo -->
    <div class="sidebar-header">
      <!-- Toggle / Logo Area -->
      <div class="logo-area">
        <!-- Hamburger Button (Only on desktop) -->
        <button v-if="!isMobile" class="hamburger-btn" @click="isCollapsedInternal = !isCollapsedInternal">
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        
        <!-- Mobile Close Button -->
        <button v-else class="hamburger-btn close-mobile" @click="emit('close-mobile')">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>


      </div>
    </div>

    <!-- 2. Primary Action (New Chat) -->
    <div class="sidebar-action">
      <button class="new-chat-btn" @click="handleNewChat" :title="t('newChat')">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span class="btn-text" v-if="!isEffectiveCollapsed">{{ t('newChat') }}</span>
      </button>
    </div>

    <!-- 3. Navigation Links -->
    <!-- 3. Navigation Links (Moved to Settings) -->
    <!-- <div class="sidebar-nav"></div> -->

    <!-- 4. Contextual Content (Scrollable) -->
    <div class="sidebar-content">
      <!-- Chat History -->
      <div class="context-section">
        <div class="section-label" v-if="!isEffectiveCollapsed">{{ t('recentChats') }}</div>
        <div class="session-list">
          <button 
            v-for="session in chatStore.sessions" 
            :key="session.sessionId"
            class="session-item"
            :class="{ 'active': session.sessionId === chatStore.currentSessionId }"
            @click="handleSelectSession(session.sessionId)"
          >
            <svg class="session-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span class="session-text" v-if="!isEffectiveCollapsed">{{ session.metadata?.title || t('newConversation') }}</span>
            <button 
                class="delete-btn"
                @click.stop="handleDeleteSession(session.sessionId)"
                :title="t('deleteChat')"
                v-if="!isEffectiveCollapsed"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </button>
        </div>
      </div>
    </div>

    <!-- 4. Footer (Settings Trigger) -->
    <div class="sidebar-footer">
      <button class="settings-trigger-btn" @click="showSettings = true" :class="{ 'collapsed': isEffectiveCollapsed }">
        <svg class="settings-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        <span class="settings-text" v-if="!isEffectiveCollapsed">{{ t('settings') }}</span>
      </button>
    </div>

    <!-- Settings Menu Overlay -->
    <Transition name="fade">
      <SettingsMenu v-if="showSettings" @close="showSettings = false" />
    </Transition>
  </aside>
</template>

<style scoped>
/* Base Layout */
.app-sidebar {
  display: flex;
  flex-direction: column;
  width: 260px;
  height: 100%;
  background-color: var(--color-bg-primary); 
  border-right: 1px solid var(--color-border); 
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  color: var(--color-text-muted); 
  z-index: 50;
  position: relative;
}

.app-sidebar.collapsed {
  width: 72px;
}

/* Mobile Styles */
.app-sidebar.mobile {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  height: 100dvh;
  width: 280px; /* Full width sidebar on mobile */
  transform: translateX(-100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: none;
}

.app-sidebar.mobile.mobile-open {
  transform: translateX(0);
  box-shadow: var(--shadow-xl);
}

/* 1. Header */
.sidebar-header {
  display: flex;
  align-items: center;
  /* Centering for collapsed state happens naturally if only one item exists and we use center alignment */
  justify-content: flex-start; 
  padding: 16px 20px;
  height: 64px;
  flex-shrink: 0;
}

.collapsed .sidebar-header {
    justify-content: center;
    padding: 16px 0;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  white-space: nowrap;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.hamburger-btn {
  background: none;
  border: none;
  color: var(--color-text-primary); /* Changed to primary to act as main icon */
  cursor: pointer;
  padding: 4px; /* Reduced padding to match previous icon size area */
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hamburger-btn:hover {
  background-color: var(--color-bg-hover);
}

/* 2. Action Button */
.sidebar-action {
  padding: 0 16px 16px;
  flex-shrink: 0;
}

.new-chat-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: var(--color-accent);
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

.collapsed .new-chat-btn {
  padding: 10px 0;
}

/* 3. Content Area */
.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px;
  /* Scrollbar Styling */
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.sidebar-content::-webkit-scrollbar {
  width: 4px;
}
.sidebar-content::-webkit-scrollbar-thumb {
  background-color: var(--color-border);
  border-radius: 4px;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-secondary);
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
  color: var(--color-text-muted);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.session-item:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.session-item:hover .delete-btn {
    opacity: 1;
}

.delete-btn {
    opacity: 0;
    margin-left: auto;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
}

.delete-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
}

.session-item.active {
  color: var(--color-accent);
  background-color: var(--color-accent-light);
}

.session-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 4. Footer */
.sidebar-footer {
  border-top: 1px solid var(--color-border);
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
  background-color: var(--color-bg-primary); 
  flex-shrink: 0;
}

.settings-trigger-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  padding: 8px;
  border-radius: 8px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.settings-trigger-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-text-muted);
}

.settings-trigger-btn.collapsed {
  justify-content: center;
  padding: 8px 0;
}

.settings-text {
  font-size: 14px;
  font-weight: 500;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  position: absolute; /* Prevent jumping during leave */
  opacity: 0;
}
</style>
