<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  modelValue: { type: Boolean, default: true },
  sessions: { type: Array, default: () => [] },
  currentSessionId: { type: String, default: null },
  isDark: { type: Boolean, default: true },
  lang: { type: String, default: 'th' },
  t: { type: Function, required: true }
})

const emit = defineEmits([
  'update:modelValue', 
  'new-chat', 
  'select-session', 
  'toggle-theme', 
  'toggle-lang', 
  'logout'
])

const authStore = useAuthStore()

const isExpanded = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: !isExpanded }">
    <div class="sidebar-inner" v-show="isExpanded">
      <!-- New Chat Button -->
      <button class="btn-new-chat" @click="emit('new-chat')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <span>{{ t('newChat') }}</span>
      </button>
      
      <!-- Sessions -->
      <div class="sessions">
        <div class="sessions-header">{{ t('recentChats') }}</div>
        
        <div 
          v-for="session in sessions.slice(0, 10)" 
          :key="session.sessionId"
          class="session-item"
          :class="{ active: session.sessionId === currentSessionId }"
          @click="emit('select-session', session.sessionId)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
          <span>Chat {{ session.metadata?.messageCount || 0 }}</span>
        </div>
        
        <div v-if="sessions.length === 0" class="sessions-empty">
          {{ t('noChats') }}
        </div>
      </div>
      
      <!-- Footer: Settings -->
      <div class="sidebar-footer">
        <!-- Settings Buttons -->
        <div class="settings-group">
          <!-- Theme Toggle -->
          <button class="btn-setting" @click="emit('toggle-theme')">
            <svg v-if="isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>
          
          <!-- Language Toggle -->
          <button class="btn-setting" @click="emit('toggle-lang')">
            <span class="lang-text">{{ lang === 'th' ? 'EN' : 'TH' }}</span>
          </button>
        </div>
        
        <!-- User & Logout -->
        <div class="user-row">
          <div class="user-avatar">
            {{ authStore.displayName?.charAt(0)?.toUpperCase() || 'U' }}
          </div>
          <div class="user-info">
            <span class="user-name">{{ authStore.displayName }}</span>
            <span class="user-role">{{ authStore.user?.role || 'User' }}</span>
          </div>
          <button class="btn-logout" @click="emit('logout')" :title="t('logout')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
.sidebar {
  width: var(--sidebar-width);
  height: 100vh;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  flex-shrink: 0;
  transition: width 0.2s ease;
  overflow: hidden;
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
  padding: 16px 12px;
}

/* New Chat */
.btn-new-chat {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
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
  margin-top: 20px;
}

.sessions-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 10px;
  margin-bottom: 8px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 13px;
  transition: all 0.15s;
}

.session-item:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.session-item.active {
  background: var(--color-accent-light);
  color: var(--color-accent);
}

.sessions-empty {
  padding: 20px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}

/* Footer */
.sidebar-footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-group {
  display: flex;
  gap: 8px;
}

.btn-setting {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
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

.lang-text {
  font-size: 12px;
  font-weight: 600;
}

/* User Row */
.user-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
}

.user-avatar {
  width: 34px;
  height: 34px;
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
