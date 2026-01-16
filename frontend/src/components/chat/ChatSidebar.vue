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

// Sidebar is controlled by parent, but we can also toggle it internally if needed
// Actually parent passed modelValue for expanded state
const isExpanded = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const showSettingsMenu = ref(false)
const toggleSettings = () => showSettingsMenu.value = !showSettingsMenu.value
const closeSettings = () => showSettingsMenu.value = false
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: !isExpanded }">
    <div class="sidebar-content">
      
      <!-- TOP: Toggle Button (Mini Sidebar Mode) -->
     <!-- Only show toggle if we want internal control, but here header has toggle. 
          Actually, let's keep it clean. Top is New Chat. -->

      <!-- New Chat Button -->
      <div class="action-section">
        <button class="btn-new-chat" @click="emit('new-chat')" :title="t('newChat')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span class="label" v-if="isExpanded">{{ t('newChat') }}</span>
        </button>
      </div>
      
      <!-- Sessions List -->
      <div class="sessions-section">
        <div class="section-label" v-if="isExpanded">{{ t('recentChats') }}</div>
        
        <div 
          v-for="session in sessions.slice(0, 10)" 
          :key="session.sessionId"
          class="session-item"
          :class="{ active: session.sessionId === currentSessionId }"
          @click="emit('select-session', session.sessionId)"
          :title="isExpanded ? '' : 'Chat ' + (session.metadata?.messageCount || 0)"
        >
          <div class="item-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
          </div>
          <span class="item-text" v-if="isExpanded">Chat {{ session.metadata?.messageCount || 0 }}</span>
        </div>
      </div>
      
      <!-- Bottom: Settings -->
      <div class="bottom-section">
        <div class="settings-wrapper" v-click-outside="closeSettings">
          <!-- Popup Menu -->
          <Transition name="fade-up">
            <div v-if="showSettingsMenu" class="settings-popup">
              <button class="popup-item" @click="emit('toggle-theme')">
                <svg v-if="isDark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
                <span>{{ isDark ? 'Light' : 'Dark' }}</span>
              </button>
              
              <button class="popup-item" @click="emit('toggle-lang')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                <span>{{ lang === 'th' ? 'English' : 'Thai' }}</span>
              </button>
              
              <div class="popup-divider"></div>
              
              <button class="popup-item danger" @click="emit('logout')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>{{ t('logout') }}</span>
              </button>
            </div>
          </Transition>
          
          <!-- Settings Trigger Button -->
          <button class="btn-settings" @click="toggleSettings" :class="{ active: showSettingsMenu }" :title="t('settings')">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span class="label" v-if="isExpanded">{{ t('settings') }}</span>
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 280px; /* Expanded Width */
  height: 100vh;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  flex-shrink: 0;
  transition: width 0.3s cubic-bezier(0.2, 0, 0, 1);
  display: flex;
  flex-direction: column;
  overflow: visible; /* Needed for popup */
  position: relative;
  z-index: 100;
}

.sidebar.collapsed {
  width: 68px; /* Mini Sidebar Width */
}

.sidebar-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
  width: 100%;
}

/* New Chat Button */
.action-section {
  margin-bottom: 24px;
}

.btn-new-chat {
  width: 100%;
  height: 44px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  justify-content: flex-start;
  overflow: hidden;
}

.sidebar.collapsed .btn-new-chat {
  justify-content: center;
  padding: 0;
}

.btn-new-chat:hover {
  background: var(--color-accent-hover);
}

/* Sessions */
.sessions-section {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  margin-bottom: 8px;
  padding-left: 8px;
  white-space: nowrap;
}

.session-item {
  height: 40px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all 0.15s;
  overflow: hidden;
}

.sidebar.collapsed .session-item {
  justify-content: center;
}

.session-item:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.session-item.active {
  background: var(--color-accent-light);
  color: var(--color-accent);
}

.item-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-text {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Bottom Settings */
.bottom-section {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.settings-wrapper {
  position: relative;
}

.btn-settings {
  width: 100%;
  height: 44px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}

.sidebar.collapsed .btn-settings {
  justify-content: center;
}

.btn-settings:hover, .btn-settings.active {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

/* Settings Popup */
.settings-popup {
  position: absolute;
  bottom: 100%;
  left: 0;
  width: 200px; /* Fixed width popup */
  margin-bottom: 8px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 6px;
  z-index: 200;
}

.popup-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}

.popup-item:hover {
  background: var(--color-bg-hover);
}

.popup-item.danger {
  color: var(--color-error);
}

.popup-item.danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.popup-divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}

/* Transition */
.fade-up-enter-active, .fade-up-leave-active {
  transition: all 0.2s ease;
}
.fade-up-enter-from, .fade-up-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
