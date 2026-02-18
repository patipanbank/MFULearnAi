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

    <!-- Left: Menu + Brand -->
    <div class="header-left">
      <button v-if="showSidebarToggle" class="btn-menu" @click="emit('toggle-sidebar')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <span class="brand-text">
        <span class="brand-dindin">DinDin</span>
        <span class="brand-ai">AI</span>
      </span>
    </div>

    <!-- Center: Knowledge Selector (desktop) -->
    <div v-if="isChat() && knowledgeStore.collections.length > 0" class="header-center">
      <KnowledgeSelector />
    </div>
    <div v-else class="header-center" />

    <!-- Right: Token (desktop) + User -->
    <div class="header-right">
      <TokenUsageBar
        v-if="authStore.user && isChat()"
        class="token-desktop"
      />
      <div class="user-pill">
        <img v-if="userAvatarUrl" :src="userAvatarUrl" class="avatar-img" referrerpolicy="no-referrer" />
        <div v-else class="avatar-fallback">{{ userInitial }}</div>
        <span class="user-name">{{ userName }}</span>
      </div>
    </div>

    <!-- Mobile bar: Knowledge + Token (row below header) -->
    <div v-if="isChat() && knowledgeStore.collections.length > 0" class="mobile-bar">
      <KnowledgeSelector />
      <TokenUsageBar v-if="authStore.user" class="token-mobile" />
    </div>

  </header>
</template>

<style scoped>
.chat-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: var(--header-height, 52px);
  align-items: center;
  padding: 0 16px;
  background: var(--color-bg-primary);
  flex-shrink: 0;
  z-index: 40;
  position: relative;
  column-gap: 12px;
}

/* Left */
.header-left {
  grid-column: 1;
  display: flex; align-items: center; gap: 10px;
}

.btn-menu {
  width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid var(--color-border);
  border-radius: 8px; color: var(--color-text-muted); cursor: pointer;
  flex-shrink: 0; transition: background 0.15s, color 0.15s;
}
.btn-menu:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }

.brand-text { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; white-space: nowrap; }
.brand-dindin {
  background: var(--color-user-gradient, linear-gradient(135deg, #6366f1, #8b5cf6));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.brand-ai {
  background: linear-gradient(135deg, #00d4ff, #0099ff);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}

/* Center */
.header-center {
  grid-column: 2;
  display: flex; justify-content: center; min-width: 0;
}

/* Right */
.header-right {
  grid-column: 3;
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
}

.user-pill {
  display: flex; align-items: center; gap: 8px;
  padding: 3px 10px 3px 3px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border); border-radius: 99px;
}
.avatar-img { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
.avatar-fallback {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--color-user-gradient, #6366f1);
  display: flex; align-items: center; justify-content: center;
  color: white; font-weight: 600; font-size: 12px;
}
.user-name { font-size: 13px; font-weight: 500; color: var(--color-text-primary); white-space: nowrap; }

/* Mobile bar */
.mobile-bar { display: none; }

/* ── Responsive ── */
@media (max-width: 768px) {
  .chat-header {
    grid-template-columns: auto 1fr auto;
    grid-template-rows: var(--header-height, 52px) auto;
    padding: 0 12px;
    column-gap: 8px;
  }

  /* ซ่อน center บน mobile */
  .header-center { display: none; }

  /* ซ่อน token desktop บน mobile */
  .token-desktop { display: none; }

  /* แสดง mobile bar */
  .mobile-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    grid-column: 1 / -1;
    grid-row: 2;
    padding: 6px 0 8px;
  }

  /* ซ่อนชื่อ user เหลือแค่ avatar */
  .user-name { display: none; }
  .user-pill { padding: 0; border: none; background: transparent; }
}

@media (max-width: 480px) {
  .chat-header { padding: 0 10px; }
  .btn-menu { border: none; width: 30px; height: 30px; }
  .brand-text { font-size: 16px; }
}
</style>