<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useLanguage } from '@/composables/useSettings'

const props = defineProps({
  envName: { type: String, default: 'MFULearnAI' },
  userName: { type: String, default: 'User' },
  userInitial: { type: String, default: 'U' },
  showSidebarToggle: { type: Boolean, default: true }
})

const emit = defineEmits(['toggle-sidebar'])

const route = useRoute()
const chatStore = useChatStore()
const knowledgeStore = useKnowledgeStore()
const { t } = useLanguage()

onMounted(() => {
    knowledgeStore.fetchCollections()
})
</script>

<template>
  <header class="chat-header">
    <div class="header-left">
      <button v-if="showSidebarToggle" class="btn-menu" @click="emit('toggle-sidebar')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      
      <div class="app-brand">
        <span class="logo-emoji">🤖</span>
        <h1>{{ envName }}</h1>
      </div>
      
        <!-- Knowledge Selector (Visible in Chat) -->
        <div v-if="route.path.includes('/chat') && knowledgeStore.collections.length > 0" class="knowledge-selector ml-4 hidden md:flex items-center gap-2">
            <span class="text-xs font-medium text-gray-400 uppercase tracking-wider">{{ t('activeKnowledge') }}</span>
            <select 
                v-model="chatStore.currentCollectionId" 
                class="bg-slate-800 text-gray-200 text-sm rounded-lg border border-slate-700 px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none max-w-[150px]"
            >
                <option :value="null">{{ t('defaultCollection') }}</option>
                <option v-for="col in knowledgeStore.collections" :key="col._id" :value="col._id">
                    {{ col.name }}
                </option>
            </select>
        </div>
    </div>
    
    <div class="header-right">
      <div class="user-display">
        <div class="user-avatar">{{ userInitial }}</div>
        <span class="user-name">{{ userName }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.chat-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.btn-menu {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-menu:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.app-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-emoji {
  font-size: 24px;
}

.app-brand h1 {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.knowledge-selector {
    padding-left: 16px;
    border-left: 1px solid var(--color-border);
}

.header-right {
  display: flex;
  align-items: center;
}

.user-display {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 6px;
  background: var(--color-bg-tertiary);
  border-radius: 50px;
  border: 1px solid var(--color-border);
}

.user-avatar {
  width: 32px;
  height: 32px;
  background: var(--color-accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  padding-right: 4px;
}

@media (max-width: 640px) {
  .user-name { display: none; }
  .knowledge-selector { display: none; } /* Hide on mobile for now or find better spot */
}
</style>
