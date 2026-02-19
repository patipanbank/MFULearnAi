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

    <!-- Left: Menu + Brand + Selector (inline) -->
    <div class="header-left">
      <button v-if="showSidebarToggle" class="btn-menu" @click="emit('toggle-sidebar')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      <!-- Brand (desktop only) -->
      <span class="brand-text desktop-only">
        <span class="brand-dindin">DinDin</span>
        <span class="brand-ai">AI</span>
      </span>

      <!-- Knowledge Selector — ติดกับ brand ทั้ง desktop และ mobile -->
      <div v-if="isChat() && knowledgeStore.collections.length > 0" class="selector-wrap">
        <KnowledgeSelector />
      </div>
    </div>

    <!-- Right: Token + User -->
    <div class="header-right">
      <TokenUsageBar v-if="authStore.user && isChat()" />

      <div class="user-pill">
        <img v-if="userAvatarUrl" :src="userAvatarUrl" class="avatar-img" referrerpolicy="no-referrer" />
        <div v-else class="avatar-fallback">{{ userInitial }}</div>
        <span class="user-name desktop-only">{{ userName }}</span>
      </div>
    </div>

  </header>
</template>

<style scoped>
.chat-header {
  height: var(--header-height, 60px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--color-bg-primary);
  flex-shrink: 0;
  z-index: 40;
  position: relative;
}

/* ── Left ── */
.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.btn-menu {
  width: 38px; height: 38px;
  display: flex; align-items: center; justify-content: center;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  color: var(--color-text-muted);
  cursor: pointer; flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.btn-menu:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }

.brand-text {
  font-size: 22px; font-weight: 700;
  letter-spacing: -0.4px; white-space: nowrap;
  flex-shrink: 0;
}
.brand-dindin {
  background: var(--color-user-gradient, linear-gradient(135deg, #6366f1, #8b5cf6));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.brand-ai {
  background: linear-gradient(135deg, #00d4ff, #0099ff);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}

.selector-wrap {
  flex-shrink: 0;
}

/* ── Right ── */
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.user-pill {
  display: flex; align-items: center; gap: 9px;
  padding: 4px 12px 4px 4px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 99px;
}
.avatar-img { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; }
.avatar-fallback {
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--color-user-gradient, #6366f1);
  display: flex; align-items: center; justify-content: center;
  color: white; font-weight: 600; font-size: 13px;
}
.user-name { font-size: 14px; font-weight: 500; color: var(--color-text-primary); white-space: nowrap; }

/* ── Helpers ── */
.desktop-only { display: block; }

/* ── Mobile ── */
@media (max-width: 768px) {
  .chat-header {
    height: var(--header-height, 54px);
    padding: 0 14px;
  }

  .header-left { gap: 10px; }

  /* ซ่อน DinDin AI บน mobile */
  .desktop-only { display: none; }

  /* menu button ไม่มี border บน mobile ประหยัดพื้นที่ */
  .btn-menu { border: none; width: 32px; height: 32px; }

  /* user pill เหลือแค่ avatar */
  .user-pill { padding: 0; border: none; background: transparent; }
}

@media (max-width: 480px) {
  .chat-header { padding: 0 10px; }
  .header-left { gap: 8px; }
}
</style>