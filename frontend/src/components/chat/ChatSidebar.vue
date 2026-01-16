<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: true },
  sessions: { type: Array, default: () => [] },
  currentSessionId: { type: String, default: null },
  t: { type: Function, required: true }
})

const emit = defineEmits([
  'update:modelValue', 
  'new-chat', 
  'select-session',
  'search'
])

const isExpanded = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const searchQuery = ref('')
const showSearch = ref(false)

const toggleSearch = () => {
  showSearch.value = !showSearch.value
  if (!showSearch.value) searchQuery.value = ''
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: !isExpanded }">
    <div class="sidebar-inner" v-show="isExpanded">
      
      <!-- Top Actions: New Chat & Search -->
      <div class="top-actions">
        <button class="btn-new-chat" @click="emit('new-chat')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span class="btn-text">{{ t('newChat') }}</span>
        </button>
        
        <button class="btn-search-toggle" @click="toggleSearch" :class="{ active: showSearch }">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
      </div>

      <!-- Search Bar -->
      <div v-if="showSearch" class="search-bar">
        <input 
          v-model="searchQuery" 
          type="text" 
          class="search-input" 
          :placeholder="t('search') || 'Search...'" 
        />
      </div>
      
      <!-- Sessions List -->
      <div class="sessions">
        <div class="sessions-header">{{ t('recentChats') }}</div>
        
        <div 
          v-for="session in sessions.slice(0, 15)" 
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
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  white-space: nowrap;
  min-width: 0; /* Critical fix for flex item collapse */
}

.sidebar.collapsed {
  width: 0 !important;
  border-right: none;
  min-width: 0 !important;
}

.sidebar-inner {
  width: var(--sidebar-width); /* Fix width to prevent squashing */
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

/* Top Actions */
.top-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.btn-new-chat {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-new-chat:hover {
  background: var(--color-accent-hover);
}

.btn-search-toggle {
  width: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-search-toggle:hover, .btn-search-toggle.active {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: var(--color-text-muted);
}

/* Search Bar */
.search-bar {
  margin-bottom: 12px;
  animation: slideDown 0.2s ease-out;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: 13px;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Sessions */
.sessions {
  flex: 1;
  overflow-y: auto;
  margin-top: 8px;
}

.sessions-header {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 8px;
  margin-bottom: 8px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
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

.sessions-empty {
  padding: 20px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}
</style>
