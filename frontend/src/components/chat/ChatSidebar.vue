<script setup>
import { ref, computed } from 'vue'

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

const showSettingsMenu = ref(false)
const isExpanded = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const toggleSettings = () => {
  showSettingsMenu.value = !showSettingsMenu.value
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: !isExpanded }">
    <div class="sidebar-inner" v-show="isExpanded">
      <!-- New Chat Button -->
      <button class="btn-new-chat" @click="emit('new-chat')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
          <span class="session-label">Chat {{ session.metadata?.messageCount || 0 }}</span>
        </div>
        
        <div v-if="sessions.length === 0" class="sessions-empty">
          {{ t('noChats') }}
        </div>
      </div>
      
      <!-- Footer: Settings Button Only -->
      <div class="sidebar-footer">
        
        <!-- Settings Menu (Popup above) -->
        <Transition name="slide-up">
          <div v-if="showSettingsMenu" class="settings-menu glass-panel">
            <button class="menu-item" @click="emit('toggle-theme')">
              <svg v-if="isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
              <span>{{ isDark ? 'Light Mode' : 'Dark Mode' }}</span>
            </button>
            
            <button class="menu-item" @click="emit('toggle-lang')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span>{{ lang === 'th' ? 'English' : 'ภาษาไทย' }}</span>
            </button>
            
            <div class="divider"></div>
            
            <button class="menu-item danger" @click="emit('logout')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>{{ t('logout') }}</span>
            </button>
          </div>
        </Transition>
        
        <!-- Main Settings Button -->
        <button class="btn-main-settings" @click="toggleSettings" :class="{ 'active': showSettingsMenu }">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>{{ t('settings') }}</span>
        </button>
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
  overflow: visible; /* Allow menu to pop out if needed, though we use absolute positioning */
  z-index: 100;
}

.sidebar.collapsed {
  width: 0;
  border-right: none;
  overflow: hidden;
}

.sidebar-inner {
  width: var(--sidebar-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  position: relative;
}

/* New Chat */
.btn-new-chat {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: var(--radius-lg);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
  transition: all 0.2s;
}

.btn-new-chat:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
}

/* Sessions */
.sessions {
  flex: 1;
  overflow-y: auto;
  margin-top: 24px;
}

.sessions-header {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 12px;
  margin-bottom: 12px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--color-text-secondary);
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

.session-label {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sessions-empty {
  padding: 24px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}

/* Footer & Settings */
.sidebar-footer {
  margin-top: auto;
  position: relative;
  padding-top: 16px;
}

.btn-main-settings {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-primary);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-main-settings:hover, .btn-main-settings.active {
  background: var(--color-bg-hover);
  border-color: var(--color-text-muted);
}

.settings-menu {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 0;
  width: 100%;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 10;
}

.glass-panel {
  backdrop-filter: blur(10px);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  width: 100%;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
}

.menu-item:hover {
  background: var(--color-bg-hover);
}

.menu-item.danger {
  color: var(--color-error);
}

.menu-item.danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}

/* Transition */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}
</style>
