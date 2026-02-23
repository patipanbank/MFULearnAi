<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
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
const chatStore = useChatStore()

// Settings
const { t } = useLanguage()

// State
const isCollapsedInternal = ref(true)
const isHovered = ref(false)
const showSettings = ref(false)
const showDeleteConfirm = ref(false)
const pendingDeleteSessionId = ref(null)

// ─── Computed ───────────────────────────────────────────────────

/** Whether sidebar is in collapsed mode (never on mobile) */
const isCollapsed = computed(() => {
    if (props.isMobile) return false
    return isCollapsedInternal.value
})

/** Visual collapse state: collapsed AND not hovered */
const isEffectiveCollapsed = computed(() => {
    if (props.isMobile) return false
    return isCollapsed.value && !isHovered.value
})

// ─── Methods ────────────────────────────────────────────────────

// Load chat sessions when sidebar mounts (ensures history is visible on any page, not just /chat)
onMounted(() => {
    if (chatStore.sessions.length === 0) {
        chatStore.loadSessions()
    }
})

const handleNewChat = () => {
    chatStore.resetSession()
    router.push('/chat')
    if (props.isMobile) emit('close-mobile')
}

const handleSelectSession = (sessionId) => {
    router.push(`/chat/${sessionId}`)
    if (props.isMobile) emit('close-mobile')
}

/** Opens custom delete confirmation modal */
const handleDeleteSession = (sessionId) => {
    pendingDeleteSessionId.value = sessionId
    showDeleteConfirm.value = true
}

/** Confirmed delete action */
const confirmDelete = async () => {
    const sessionId = pendingDeleteSessionId.value
    if (!sessionId) return

    try {
        await chatStore.deleteSession(sessionId)
        if (chatStore.currentSessionId === sessionId) {
            chatStore.resetSession()
        }
        await chatStore.loadSessions()
    } finally {
        showDeleteConfirm.value = false
        pendingDeleteSessionId.value = null
    }
}

const cancelDelete = () => {
    showDeleteConfirm.value = false
    pendingDeleteSessionId.value = null
}

// ── Keyboard support for delete confirmation modal ──
const handleDeleteKeydown = (e) => {
  if (!showDeleteConfirm.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    cancelDelete()
  } else if (e.key === 'Enter') {
    const tag = e.target?.tagName?.toLowerCase()
    if (tag !== 'button') {
      e.preventDefault()
      e.stopPropagation()
      confirmDelete()
    }
  }
}

onMounted(() => document.addEventListener('keydown', handleDeleteKeydown, true))
onUnmounted(() => document.removeEventListener('keydown', handleDeleteKeydown, true))
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
    <!-- 1. Header & Toggle -->
    <div class="sidebar-header">
      <div class="logo-area">
        <!-- Desktop: Hamburger Toggle -->
        <button 
          v-if="!isMobile" 
          id="sidebar-toggle-btn"
          class="hamburger-btn" 
          @click="isCollapsedInternal = !isCollapsedInternal"
          :aria-label="isCollapsedInternal ? t('expandSidebar') || 'Expand sidebar' : t('collapseSidebar') || 'Collapse sidebar'"
        >
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        
        <!-- Mobile: Close Button -->
        <button 
          v-else 
          id="sidebar-close-mobile-btn"
          class="hamburger-btn close-mobile" 
          @click="emit('close-mobile')"
          aria-label="Close sidebar"
        >
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>

    <!-- 2. Primary Action (New Chat) -->
    <div class="sidebar-action">
      <button id="new-chat-btn" class="new-chat-btn" @click="handleNewChat" :title="t('newChat')">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span class="btn-text" v-if="!isEffectiveCollapsed">{{ t('newChat') }}</span>
      </button>
    </div>

    <!-- 3. Scrollable Content (Chat History) -->
    <div class="sidebar-content">
      <div class="context-section">
        <div class="section-label" v-if="!isEffectiveCollapsed">{{ t('recentChats') }}</div>
        <div class="session-list">
          <button 
            v-for="session in chatStore.sessions" 
            :key="session.sessionId"
            :id="`session-${session.sessionId}`"
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
                :aria-label="t('deleteChat')"
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
      <button 
        id="settings-trigger-btn" 
        class="settings-trigger-btn" 
        @click="showSettings = true" 
        :class="{ 'collapsed': isEffectiveCollapsed }"
        :aria-label="t('settings')"
      >
        <svg class="settings-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        <span class="settings-text" v-if="!isEffectiveCollapsed">{{ t('settings') }}</span>
      </button>
    </div>

    <!-- Settings Menu Overlay -->
    <Transition name="fade">
      <SettingsMenu v-if="showSettings" @close="showSettings = false" />
    </Transition>

    <!-- Delete Confirmation Modal (replaces browser confirm()) -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="confirmation-overlay" @click.self="cancelDelete">
        <div class="confirmation-modal">
          <h3 class="confirmation-title">{{ t('deleteChat') }}</h3>
          <p class="confirmation-message">{{ t('confirmDeleteChat') }}</p>
          <div class="confirmation-actions">
            <button id="cancel-delete-btn" class="action-btn cancel" @click="cancelDelete">
              {{ t('cancel') }}
            </button>
            <button id="confirm-delete-btn" class="action-btn confirm" @click="confirmDelete">
              {{ t('confirm') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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
  padding-bottom: env(safe-area-inset-bottom, 0px);
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
  height: 100svh;
  width: 280px;
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

.hamburger-btn {
  background: none;
  border: none;
  color: var(--color-text-primary);
  cursor: pointer;
  padding: 4px;
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
  min-height: 0;
  overflow-y: auto;
  padding: 0 12px;
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
    color: var(--color-error, #ef4444);
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
  position: absolute;
  opacity: 0;
}

/* Delete Confirmation Modal */
.confirmation-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;
}

.confirmation-modal {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 24px;
  width: 90%;
  max-width: 320px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.confirmation-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.confirmation-message {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0 0 24px 0;
  line-height: 1.5;
}

.confirmation-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.action-btn.cancel {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.action-btn.cancel:hover {
  background: var(--color-bg-hover);
}

.action-btn.confirm {
  background: var(--color-error, #ef4444);
  color: white;
  box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);
}

.action-btn.confirm:hover {
  filter: brightness(90%);
  transform: translateY(-1px);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>