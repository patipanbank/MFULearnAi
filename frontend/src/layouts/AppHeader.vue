<script setup>
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useAuthStore } from '@/stores/auth'
import KnowledgeSelector from '@/components/chat/KnowledgeSelector.vue'
import TokenUsageBar from '@/components/common/TokenUsageBar.vue'
import { useLanguage } from '@/composables/useSettings'

const { t } = useLanguage()

const props = defineProps({
  envName: { type: String, default: 'MFULearnAI' },
  userName: { type: String, default: 'User' },
  userInitial: { type: String, default: 'U' },
  userAvatarUrl: { type: String, default: '' },
  showSidebarToggle: { type: Boolean, default: true }
})

const emit = defineEmits(['toggle-sidebar'])

const route = useRoute()
const knowledgeStore = useKnowledgeStore()
const authStore = useAuthStore()

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
        <div v-if="route.path.includes('/chat') && knowledgeStore.collections.length > 0" class="knowledge-container">
            <KnowledgeSelector />
            <!-- Token Usage Bar -->
            <div class="hidden-mobile">
                <TokenUsageBar v-if="authStore.user" />
            </div>
        </div>
    </div>
    
    <div class="header-right">
      <div class="user-display">
        <img v-if="userAvatarUrl" :src="userAvatarUrl" class="user-avatar-img" alt="Profile" referrerpolicy="no-referrer" />
        <div v-else class="user-avatar">{{ userInitial }}</div>
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
  flex-shrink: 0;
  z-index: 40;
  position: relative;
  width: 100%;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0; /* Allow flex children to shrink */
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
  flex-shrink: 0;
}

.btn-menu:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.app-branding {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
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
  color: transparent;
}

.ai-gradient {
  background: linear-gradient(135deg, #00e1ff, #0099ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
}

.knowledge-container {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-left: 24px;
    flex: 0 1 auto;
    min-width: 0;
}

.header-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding-left: 16px;
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

.user-avatar-img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
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

/* Helper to hide elements on mobile */
.hidden-mobile {
    display: flex;
}

@media (max-width: 640px) {
  .chat-header {
      padding: 0 12px;
      gap: 8px;
  }

  .btn-menu {
      border: none;
      padding: 0;
      width: 40px;
  }

  /* Hide Branding text on mobile to save space */
  .app-name {
      display: none;
  }
  
  /* Reset margins and gaps for the container */
  .knowledge-container {
      margin-left: 0;
      gap: 8px;
      flex: 1; /* Let it grow to fill space */
      max-width: 100%;
  }

  /* Hide Token Usage on mobile */
  .hidden-mobile {
      display: none;
  }

  .user-name { 
      display: none; 
  }
  
  .user-display {
      padding: 0;
      border: none;
      background: transparent;
  }
}
</style>
