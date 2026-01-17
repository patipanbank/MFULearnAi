<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  sessions: { type: Array, default: () => [] },
  currentSessionId: { type: String, default: null },
  t: { type: Function, required: true }
})

const emit = defineEmits([
  'update:modelValue',
  'new-chat',
  'select-session'
])

const toggleSidebar = () => {
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <aside 
    class="session-sidebar"
    :class="[modelValue ? 'w-64' : 'w-0 overflow-hidden']"
  >
    <div class="flex flex-col h-full bg-slate-900/50 border-r border-slate-700/50 backdrop-blur-sm transition-all duration-300">
      
      <!-- New Chat Button -->
      <div class="p-3 border-b border-slate-700/50">
        <button 
          class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg shadow-blue-900/20 transition-all transform hover:-translate-y-0.5 font-medium text-sm"
          @click="emit('new-chat')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          <span>{{ t('newChat') }}</span>
        </button>
      </div>

      <!-- Session List -->
      <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
        <h3 class="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">{{ t('recentChats') }}</h3>
        
        <button 
          v-for="session in sessions" 
          :key="session.sessionId"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left group border border-transparent"
          :class="[
            session.sessionId === currentSessionId 
              ? 'bg-blue-900/20 text-blue-400 border-blue-500/20' 
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
          ]"
          @click="emit('select-session', session.sessionId)"
        >
          <svg class="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
          <span class="truncate text-xs font-medium">{{ session.metadata?.title || 'New Conversation' }}</span>
        </button>
      </div>
      
    </div>
  </aside>
</template>

<style scoped>
.session-sidebar {
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}
</style>
