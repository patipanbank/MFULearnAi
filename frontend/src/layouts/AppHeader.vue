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

onMounted(() => knowledgeStore.fetchCollections())

const isChat = () => route.path.includes('/chat')
</script>

<template>
  <header class="chat-header">
    <div class="header-left">
      <!-- Menu Toggle -->
      <button
        v-if="showSidebarToggle"
        class="btn-menu"
        @click="emit('toggle-sidebar')"
        :title="t('toggleSidebar')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      <!-- Branding -->
      <div class="app-branding">
        <span class="brand-text">
          <span class="brand-dindin">DinDin</span>
          <span class="brand-ai">AI</span>
        </span>
      </div>

      <!-- Knowledge Selector -->
      <div
        v-if="isChat() && knowledgeStore.collections.length > 0"
        class="knowledge-container"
      >
        <KnowledgeSelector />
        <TokenUsageBar v-if="authStore.user" />
      </div>
    </div>

    <!-- User -->
    <div class="header-right">
      <div class="user-pill">
        <img
          v-if="userAvatarUrl"
          :src="userAvatarUrl"
          class="user-avatar-img"
          alt="Profile"
          referrerpolicy="no-referrer"
        />
        <div v-else class="user-avatar-fallback">{{ userInitial }}</div>
        <span class="user-name">{{ userName }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.chat-header {
  height: var(--header-height, 56px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  z-index: 40;
  position: relative;
}

/* ── Left ── */
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.btn-menu {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.btn-menu:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

/* Branding */
.app-branding { flex-shrink: 0; }
.brand-text { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
.brand-dindin {
  background: var(--color-user-gradient, linear-gradient(135deg, #6366f1, #8b5cf6));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.brand-ai {
  background: linear-gradient(135deg, #00d4ff, #0099ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Knowledge */
.knowledge-container {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 1 auto;
  min-width: 0;
}

/* ── Right ── */
.header-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding-left: 12px;
}

.user-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 4px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 99px;
}

.user-avatar-img {
  width: 28px; height: 28px;
  border-radius: 50%; object-fit: cover;
}

.user-avatar-fallback {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--color-user-gradient, #6366f1);
  display: flex; align-items: center; justify-content: center;
  color: white; font-weight: 600; font-size: 12px;
}

.user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

/* ── Responsive ── */
@media (max-width: 1024px) {
  .brand-text { font-size: 18px; }
}

@media (max-width: 640px) {
  .chat-header { padding: 0 12px; gap: 8px; }
  .btn-menu { border: none; width: 32px; height: 32px; }
  .brand-text { font-size: 16px; }
  .knowledge-container { flex: 1; justify-content: flex-end; }
  .user-name { display: none; }
  .user-pill { padding: 0; border: none; background: transparent; }
}
</style>