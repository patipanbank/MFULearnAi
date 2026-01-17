<script setup>
import { computed } from 'vue'

const props = defineProps({
  sessions: { type: Array, default: () => [] },
  currentSessionId: { type: String, default: null },
  t: { type: Function, required: true }
})

const emit = defineEmits(['new-chat', 'select-session'])
</script>

<template>
  <div class="session-list">
    <!-- New Chat Button -->
    <button 
      class="new-chat-btn"
      @click="emit('new-chat')"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
      <span>{{ t('newChat') }}</span>
    </button>

    <!-- Recent Chats Header -->
    <h3 class="section-title">{{ t('recentChats') }}</h3>
    
    <!-- Session List -->
    <div class="sessions">
      <button 
        v-for="session in sessions" 
        :key="session.sessionId"
        class="session-item"
        :class="{ active: session.sessionId === currentSessionId }"
        @click="emit('select-session', session.sessionId)"
      >
        <svg class="session-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <span class="session-title">{{ session.metadata?.title || 'New Conversation' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.session-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 8px;
}

.new-chat-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.new-chat-btn:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-1px);
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 4px 4px 0;
}

.sessions {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: #94a3b8;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}

.session-item:hover {
  background: rgba(30, 41, 59, 0.5);
  color: #f1f5f9;
}

.session-item.active {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.session-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0.7;
}

.session-title {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
