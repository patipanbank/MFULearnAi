<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: true
  },
  sessions: {
    type: Array,
    default: () => []
  },
  currentSessionId: {
    type: String,
    default: null
  },
  envName: {
    type: String,
    default: 'MFULearnAI'
  },
  envType: {
    type: String,
    default: 'TEST'
  }
})

const emit = defineEmits(['update:modelValue', 'new-chat', 'select-session', 'logout'])

const authStore = useAuthStore()

const isExpanded = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})
</script>

<template>
  <aside class="sidebar glass" :class="{ collapsed: !isExpanded }">
    <div class="sidebar-inner">
      <!-- Header -->
      <div class="sidebar-header">
        <div class="logo-container">
          <div class="logo-glow">
            <span class="logo-emoji">🤖</span>
          </div>
          <div class="logo-text" v-if="isExpanded">
            <span class="app-name">{{ envName }}</span>
            <span class="app-badge" v-if="envType === 'TEST'">Beta</span>
          </div>
        </div>
      </div>
      
      <!-- New Chat Button -->
      <button 
        v-if="isExpanded"
        class="btn-new-chat" 
        @click="emit('new-chat')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <span>New Chat</span>
      </button>
      
      <!-- Session History -->
      <div class="session-list" v-if="isExpanded">
        <div class="session-section">
          <span class="section-title">Recent Conversations</span>
        </div>
        
        <TransitionGroup name="session">
          <div 
            v-for="session in sessions.slice(0, 10)" 
            :key="session.sessionId"
            class="session-item"
            :class="{ active: session.sessionId === currentSessionId }"
            @click="emit('select-session', session.sessionId)"
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
        
        <div v-if="sessions.length === 0" class="empty-sessions">
          <span>No conversations yet</span>
        </div>
      </div>
      
      <!-- User Profile -->
      <div class="sidebar-footer" v-if="isExpanded">
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
          <button class="btn-logout" @click="emit('logout')" title="Logout">
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
</template>

<style scoped>
/* Sidebar Styles */
.sidebar {
  width: var(--sidebar-width, 300px);
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
  width: var(--sidebar-width, 300px);
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

/* Transitions */
.session-enter-active,
.session-leave-active {
  transition: all 0.3s ease;
}

.session-enter-from,
.session-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
