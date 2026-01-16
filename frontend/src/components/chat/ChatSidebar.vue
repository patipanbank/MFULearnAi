<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  modelValue: { type: Boolean, default: true },
  sessions: { type: Array, default: () => [] },
  currentSessionId: { type: String, default: null },
  envName: { type: String, default: 'MFULearnAI' },
  t: { type: Function, required: true }
})

const emit = defineEmits(['update:modelValue', 'new-chat', 'select-session', 'logout', 'toggle-theme', 'toggle-lang'])

const authStore = useAuthStore()

const isExpanded = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: !isExpanded }">
    <div class="sidebar-content">
      <!-- Header -->
      <header class="sidebar-header">
        <div class="logo">
          <span class="logo-icon">🤖</span>
          <span v-if="isExpanded" class="logo-text">{{ envName }}</span>
        </div>
      </header>
      
      <!-- New Chat -->
      <button class="btn-new-chat" @click="emit('new-chat')" v-if="isExpanded">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <span>{{ t('newChat') }}</span>
      </button>
      
      <!-- Sessions -->
      <nav class="sessions" v-if="isExpanded">
        <div class="sessions-label">{{ t('recentChats') }}</div>
        
        <div 
          v-for="session in sessions.slice(0, 8)" 
          :key="session.sessionId"
          class="session-item"
          :class="{ active: session.sessionId === currentSessionId }"
          @click="emit('select-session', session.sessionId)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
          <span class="session-title">Chat {{ session.metadata?.messageCount || 0 }}</span>
        </div>
        
        <div v-if="sessions.length === 0" class="sessions-empty">
          {{ t('noChats') }}
        </div>
      </nav>
      
      <!-- Footer -->
      <footer class="sidebar-footer" v-if="isExpanded">
        <!-- Settings Row -->
        <div class="settings-row">
          <button class="btn-setting" @click="emit('toggle-theme')" :title="t('settings')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </button>
          <button class="btn-setting" @click="emit('toggle-lang')">
            <span class="lang-badge">TH/EN</span>
          </button>
        </div>
        
        <!-- User -->
        <div class="user-card">
          <div class="user-avatar">
            {{ authStore.displayName?.charAt(0)?.toUpperCase() || 'U' }}
          </div>
          <div class="user-info">
            <span class="user-name">{{ authStore.displayName }}</span>
            <span class="user-role">{{ authStore.user?.department || authStore.user?.role }}</span>
          </div>
          <button class="btn-logout" @click="emit('logout')" :title="t('logout')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </footer>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  height: 100vh;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
  flex-shrink: 0;
}

.sidebar.collapsed {
  width: 0;
  overflow: hidden;
  border-right: none;
}

.sidebar-content {
  width: var(--sidebar-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

/* Header */
.sidebar-header {
  padding: 8px 4px;
  margin-bottom: 12px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* New Chat Button */
.btn-new-chat {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-new-chat:hover {
  background: var(--color-accent-hover);
}

/* Sessions */
.sessions {
  flex: 1;
  overflow-y: auto;
  margin-top: 16px;
}

.sessions-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 8px;
  margin-bottom: 8px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: background 0.15s, color 0.15s;
}

.session-item:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.session-item.active {
  background: var(--color-accent-light);
  color: var(--color-accent);
}

.session-title {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sessions-empty {
  padding: 16px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}

/* Footer */
.sidebar-footer {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

.settings-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.btn-setting {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-setting:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.lang-badge {
  font-size: 11px;
  font-weight: 600;
}

/* User Card */
.user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
}

.user-avatar {
  width: 36px;
  height: 36px;
  background: var(--color-accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  color: white;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  display: block;
  font-size: 11px;
  color: var(--color-text-muted);
}

.btn-logout {
  padding: 6px;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color 0.15s;
}

.btn-logout:hover {
  color: var(--color-error);
}
</style>
