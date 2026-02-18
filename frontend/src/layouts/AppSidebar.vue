<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import { useLanguage } from '@/composables/useSettings'
import SettingsMenu from './SettingsMenu.vue'

// --- Icons (lucide-vue-next แทน inline SVG) ---
import {
  Menu, X, Plus, MessageSquare, Trash2, Settings
} from 'lucide-vue-next'

// --- Props & Emits ---
const props = defineProps({
  isMobile: { type: Boolean, default: false },
  mobileOpen: { type: Boolean, default: false }
})
const emit = defineEmits(['close-mobile'])

// --- Core ---
const router = useRouter()
const chatStore = useChatStore()
const { t } = useLanguage()

// --- Sidebar State ---
const isPinned = ref(false)   // true = user pin ให้ expand ตลอด
const isHovered = ref(false)
const showSettings = ref(false)

// Sidebar collapse logic:
// - Mobile: ไม่ collapse
// - Desktop: collapse เมื่อไม่ได้ pin และไม่ได้ hover
const isEffectiveCollapsed = computed(() => {
  if (props.isMobile) return false
  if (isPinned.value) return false
  return !isHovered.value
})

// --- Swipe to Delete State ---
// swipedSessionId: session ที่กำลัง swipe อยู่
const swipedSessionId = ref(null)
const swipeStartX = ref(0)
const swipeCurrentX = ref(0)
const SWIPE_THRESHOLD = 80
const didSwipe = ref(false) // guard: ถ้า swipe เกิน threshold ไม่ให้ click ทำงาน

const getSwipeOffset = (sessionId) => {
  if (swipedSessionId.value !== sessionId) return 0
  const delta = swipeStartX.value - swipeCurrentX.value
  return Math.max(0, Math.min(delta, SWIPE_THRESHOLD + 20))
}

const onTouchStart = (e, sessionId) => {
  // Reset previous swipe ของ session อื่นที่อาจค้างอยู่
  swipedSessionId.value = sessionId
  swipeStartX.value = e.touches[0].clientX
  swipeCurrentX.value = e.touches[0].clientX
  didSwipe.value = false
}

const onTouchMove = (e, sessionId) => {
  if (swipedSessionId.value !== sessionId) return
  swipeCurrentX.value = e.touches[0].clientX
  // Mark as swipe ถ้าขยับแนวนอนเกิน 10px เพื่อป้องกัน mis-tap
  if (Math.abs(swipeStartX.value - swipeCurrentX.value) > 10) {
    didSwipe.value = true
  }
}

const onTouchEnd = async (sessionId) => {
  const offset = getSwipeOffset(sessionId)
  if (offset >= SWIPE_THRESHOLD) {
    await handleDeleteSession(sessionId)
  }
  swipedSessionId.value = null
  swipeStartX.value = 0
  swipeCurrentX.value = 0
  // Reset didSwipe หลัง event loop เพื่อให้ click handler ตรวจได้
  setTimeout(() => { didSwipe.value = false }, 0)
}

const handleSessionClick = (sessionId) => {
  if (didSwipe.value) return // ป้องกัน click หลัง swipe
  handleSelectSession(sessionId)
}

// --- Methods ---
const handleNewChat = () => {
  chatStore.resetSession()
  router.push('/chat')
  if (props.isMobile) emit('close-mobile')
}

const handleSelectSession = (sessionId) => {
  router.push(`/chat/${sessionId}`)
  if (props.isMobile) emit('close-mobile')
}

const handleDeleteSession = async (sessionId) => {
  // ✅ เช็คก่อน delete ว่า active อยู่ไหม
  const isActive = chatStore.currentSessionId === sessionId
  await chatStore.deleteSession(sessionId)
  if (isActive) {
    chatStore.resetSession()
    router.push('/chat')
  }
  // ✅ ไม่ต้อง loadSessions() อีกถ้า store จัดการ array เอง
}
</script>

<template>
  <aside
    class="app-sidebar"
    :class="{
      collapsed: isEffectiveCollapsed,
      mobile: isMobile,
      'mobile-open': mobileOpen
    }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- 1. Header -->
    <div class="sidebar-header">
      <!-- Desktop: Hamburger (toggle pin) -->
      <button
        v-if="!isMobile"
        class="icon-btn hamburger-btn"
        :class="{ pinned: isPinned }"
        :title="isPinned ? 'Collapse sidebar' : 'Pin sidebar'"
        @click="isPinned = !isPinned"
      >
        <Menu :size="22" />
      </button>

      <!-- Mobile: Close -->
      <button
        v-else
        class="icon-btn"
        :title="t('close')"
        @click="emit('close-mobile')"
      >
        <X :size="22" />
      </button>
    </div>

    <!-- 2. New Chat -->
    <div class="sidebar-action">
      <button class="new-chat-btn" :title="t('newChat')" @click="handleNewChat">
        <Plus :size="18" />
        <span v-if="!isEffectiveCollapsed" class="btn-text">{{ t('newChat') }}</span>
      </button>
    </div>

    <!-- 3. Session List -->
    <div class="sidebar-content">
      <div class="context-section">
        <div v-if="!isEffectiveCollapsed" class="section-label">
          {{ t('recentChats') }}
        </div>

        <!-- Empty state -->
        <p v-if="chatStore.sessions.length === 0 && !isEffectiveCollapsed" class="empty-state">
          {{ t('noRecentChats') || 'No recent chats' }}
        </p>

        <div class="session-list">
          <div
            v-for="session in chatStore.sessions"
            :key="session.sessionId"
            class="session-wrapper"
          >
            <!-- Delete bg revealed on swipe -->
            <div class="swipe-delete-bg" aria-hidden="true">
              <Trash2 :size="16" />
            </div>

            <!-- Session row: flex container -->
            <div
              class="session-row"
              :class="{ active: session.sessionId === chatStore.currentSessionId }"
              :style="{ transform: `translateX(-${getSwipeOffset(session.sessionId)}px)` }"
              @touchstart.passive="onTouchStart($event, session.sessionId)"
              @touchmove.passive="onTouchMove($event, session.sessionId)"
              @touchend="onTouchEnd(session.sessionId)"
            >
              <!-- Main clickable area -->
              <button
                class="session-item"
                :title="isEffectiveCollapsed ? (session.metadata?.title || t('newConversation')) : undefined"
                @click="handleSessionClick(session.sessionId)"
              >
                <MessageSquare :size="14" class="session-icon" />
                <span v-if="!isEffectiveCollapsed" class="session-text">
                  {{ session.metadata?.title || t('newConversation') }}
                </span>
              </button>

              <!-- Desktop delete (hover reveal, outside session-item) -->
              <button
                v-if="!isEffectiveCollapsed"
                class="delete-btn"
                :title="t('deleteChat')"
                @click.stop="handleDeleteSession(session.sessionId)"
              >
                <Trash2 :size="13" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. Footer: Settings -->
    <div class="sidebar-footer">
      <button
        class="settings-trigger-btn"
        :class="{ collapsed: isEffectiveCollapsed }"
        @click="showSettings = true"
      >
        <Settings :size="18" class="settings-icon" />
        <span v-if="!isEffectiveCollapsed" class="settings-text">{{ t('settings') }}</span>
      </button>
    </div>

    <!-- Settings Menu Overlay -->
    <Transition name="fade">
      <SettingsMenu v-if="showSettings" @close="showSettings = false" />
    </Transition>
  </aside>
</template>

<style scoped>
/* ─── Base Layout ─── */
.app-sidebar {
  display: flex;
  flex-direction: column;
  width: 260px;
  height: 100%;
  background-color: var(--color-bg-primary);
  border-right: 1px solid var(--color-border);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  color: var(--color-text-muted);
  z-index: 50;
  position: relative;
}

.app-sidebar.collapsed {
  width: 72px;
}

/* ─── Mobile ─── */
.app-sidebar.mobile {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 280px;
  transform: translateX(-100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.app-sidebar.mobile.mobile-open {
  transform: translateX(0);
  box-shadow: var(--shadow-xl);
}

/* ─── Header ─── */
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 16px 20px;
  height: 64px;
  flex-shrink: 0;
}

.collapsed .sidebar-header {
  justify-content: center;
  padding: 16px 0;
}

.icon-btn {
  background: none;
  border: none;
  color: var(--color-text-primary);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.icon-btn:hover {
  background: var(--color-bg-hover);
}

/* Pinned state: icon tinted with accent */
.hamburger-btn.pinned {
  color: var(--color-accent);
}

/* ─── New Chat ─── */
.sidebar-action {
  padding: 0 16px 16px;
  flex-shrink: 0;
}

.new-chat-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: var(--color-accent);
  color: white;
  border: none;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: filter 0.2s, transform 0.2s;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
}

.new-chat-btn:hover {
  filter: brightness(110%);
  transform: translateY(-1px);
}

.collapsed .new-chat-btn {
  padding: 10px 0;
}

/* ─── Content / Session List ─── */
.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.sidebar-content::-webkit-scrollbar { width: 4px; }
.sidebar-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-secondary);
  padding: 8px 12px 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.empty-state {
  font-size: 12px;
  color: var(--color-text-muted);
  padding: 8px 12px;
  margin: 0;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ─── Swipe to Delete ─── */
.session-wrapper {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
}

.swipe-delete-bg {
  position: absolute;
  inset: 0;
  background: #ef4444;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 16px;
  color: white;
  border-radius: 6px;
  pointer-events: none;
}

/* Row = flex wrapper that slides on swipe */
.session-row {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--color-bg-primary);
  border-radius: 6px;
  transition: background 0.15s, color 0.15s, transform 0.05s linear;
  will-change: transform;
}

.session-row:hover {
  background: var(--color-bg-hover);
}

.session-row:hover .delete-btn {
  opacity: 1;
}

.session-row.active {
  background: var(--color-accent-light);
}

.session-row.active .session-item {
  color: var(--color-accent);
}

/* Session button = just the main content, fills remaining space */
.session-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: none;
  border: none;
  text-align: left;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 13px;
  min-width: 0; /* allow text-overflow to work */
}

.session-row:hover .session-item {
  color: var(--color-text-primary);
}

.session-row.active .session-item {
  color: var(--color-accent);
}

.session-icon {
  flex-shrink: 0;
}

.session-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Desktop delete button (hover reveal) */
.delete-btn {
  opacity: 0;
  margin-left: auto;
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: opacity 0.2s, color 0.15s, background 0.15s;
}

.delete-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

/* ─── Footer ─── */
.sidebar-footer {
  border-top: 1px solid var(--color-border);
  padding: 16px;
  /* iOS safe area */
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  background: var(--color-bg-primary);
  flex-shrink: 0;
}

.settings-trigger-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  padding: 8px 12px;
  border-radius: 8px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.settings-trigger-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-text-muted);
}

.settings-trigger-btn.collapsed {
  justify-content: center;
  padding: 8px 0;
}

.settings-text {
  font-size: 14px;
  font-weight: 500;
}

/* ─── Transitions ─── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  position: absolute;
}
</style>