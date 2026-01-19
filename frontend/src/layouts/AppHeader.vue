<script setup>
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useKnowledgeStore } from '@/stores/knowledge'
import KnowledgeSelector from '@/components/chat/KnowledgeSelector.vue'
import { useLanguage } from '@/composables/useSettings'

const { t } = useLanguage()

const props = defineProps({
  envName: { type: String, default: 'MFULearnAI' },
  userName: { type: String, default: 'User' },
  userInitial: { type: String, default: 'U' },
  showSidebarToggle: { type: Boolean, default: true }
})

const emit = defineEmits(['toggle-sidebar'])

const route = useRoute()
const knowledgeStore = useKnowledgeStore()

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

      <!-- App Branding (Moved from Sidebar) -->
      <div class="app-branding">
         <h1 class="app-name">
            <span class="brand-gradient">DinDin</span> <span class="ai-gradient">AI</span>
         </h1>
      </div>
      
        <!-- Premium Knowledge Selector -->
        <div v-if="route.path.includes('/chat') && knowledgeStore.collections.length > 0" class="ml-6">
            <KnowledgeSelector />
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
  /* border-bottom: 1px solid var(--color-border); */
  flex-shrink: 0;
  z-index: 40;
  position: relative;
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
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

@media (max-width: 640px) {
    .btn-menu {
        width: 100%;
        height: 100%;
        aspect-ratio: 1; /* Keep it square-ish if possible, or just fit */
        border: none;
        padding: 0;
    }
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

.app-branding {
  display: flex;
  align-items: center;
  gap: 12px;
  /* margin-right: 24px; REMOVED to keep it tighter to the left */
}

.logo-small {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.header-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
}

.app-name {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  white-space: nowrap;
}

.brand-gradient {
  background: var(--color-user-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent; /* Fallback */
}

.ai-gradient {
  background: linear-gradient(135deg, #00e1ff, #0099ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent; /* Fallback */
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
  background: var(--color-user-gradient);
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
  
  .chat-header {
      padding: 0 8px; /* Reduced outer padding */
      gap: 4px; /* Small gap to separate sections */
  }

  .header-left {
      flex: 1; /* Grows to take up 90% space alongside header-right */
      width: 90%; /* Logic: 10% hamburger + 80% selector */
      gap: 8px;
  }
  
  .header-right {
      flex: 0 0 10%; /* Fixed 10% width */
      display: flex;
      justify-content: center;
  }

  /* Hamburger Container */
  .header-left > .btn-menu {
      flex: 0 0 10%; /* 10% of the left container? No, 10% of total screen roughly */
      width: 40px; /* Fallback */
      min-width: 32px;
  }

  /* Knowledge Selector Container */
  .header-left > .ml-6 {
      margin-left: 0 !important;
      flex: 1; /* Take remaining space (80%) */
      width: 100%;
      min-width: 0;
  }
  
  .user-display {
      padding: 0;
      border: none;
      background: transparent;
  }
  .user-avatar {
      width: 32px;
      height: 32px;
  }
}
</style>
