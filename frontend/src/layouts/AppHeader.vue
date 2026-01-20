<script setup>
import { ref, onMounted, onUnmounted, nextTick, reactive } from 'vue' // Added reactive
import { useRoute } from 'vue-router'
import { useKnowledgeStore } from '@/stores/knowledge'
import KnowledgeSelector from '@/components/chat/KnowledgeSelector.vue'
import { useLanguage } from '@/composables/useSettings'

const { t } = useLanguage()

const props = defineProps({
  envName: { type: String, default: 'MFULearnAI' },
  userName: { type: String, default: 'User' },
  userInitial: { type: String, default: 'U' },
  userAvatarUrl: { type: String, default: '' },
  userRole: { type: String, default: '' },
  userDepartment: { type: String, default: '' },
  userEmail: { type: String, default: '' },
  showSidebarToggle: { type: Boolean, default: true }
})

const emit = defineEmits(['toggle-sidebar', 'logout'])

const route = useRoute()
const knowledgeStore = useKnowledgeStore()

const showProfileMenu = ref(false)
const profileMenuRef = ref(null) // Button ref
const dropdownRef = ref(null) // Menu ref (not strictly needed for click-outside if using backdrop)
const dropdownPosition = reactive({ top: 0, left: 0 })

const updatePosition = () => {
    if (profileMenuRef.value) {
        const rect = profileMenuRef.value.getBoundingClientRect()
        dropdownPosition.top = rect.bottom + 8
        // Align right edge: left = right - width (300px)
        dropdownPosition.left = rect.right - 280 
        
        // Safety check for mobile/small screens
        if (dropdownPosition.left < 10) dropdownPosition.left = 10
    }
}

const toggleProfileMenu = async () => {
    if (!showProfileMenu.value) {
        showProfileMenu.value = true
        await nextTick()
        updatePosition()
    } else {
        showProfileMenu.value = false
    }
}

const closeProfileMenu = () => {
    showProfileMenu.value = false
}

const handleScrollResize = () => {
    if (showProfileMenu.value) updatePosition()
}

onMounted(() => {
    knowledgeStore.fetchCollections()
    window.addEventListener('resize', handleScrollResize)
    window.addEventListener('scroll', handleScrollResize, true)
})

onUnmounted(() => {
    window.removeEventListener('resize', handleScrollResize)
    window.removeEventListener('scroll', handleScrollResize, true)
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
      <div class="user-display" @click.stop="toggleProfileMenu" ref="profileMenuRef">
        <img v-if="userAvatarUrl" :src="userAvatarUrl" class="user-avatar-img" alt="Profile" referrerpolicy="no-referrer" />
        <div v-else class="user-avatar">{{ userInitial }}</div>
        <span class="user-name">{{ userName }}</span>

        <!-- Teleported Profile Dropdown -->
        <Teleport to="body">
            <div v-if="showProfileMenu" class="overlay-container">
                 <div class="backdrop" @click="closeProfileMenu"></div>
                 <div 
                    class="profile-dropdown"
                    :style="{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`
                    }"
                >
                    <div class="dropdown-header">
                        <div class="user-info-large">
                            <div class="user-avatar large">{{ userInitial }}</div>
                            <div>
                                <div class="font-bold">{{ userName }}</div>
                                <div class="text-xs text-muted">{{ userEmail }}</div>
                            </div>
                        </div>
                    </div>
                    <div class="dropdown-body">
                        <div class="info-item">
                            <span class="label">Role:</span>
                            <span class="value badge">{{ userRole }}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Department:</span>
                            <span class="value">{{ userDepartment || 'N/A' }}</span>
                        </div>
                    </div>
                    <div class="dropdown-footer">
                        <button class="btn-logout" @click="emit('logout')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                <polyline points="16 17 21 12 16 7"/>
                                <line x1="21" y1="12" x2="9" y2="12"/>
                            </svg>
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
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
  cursor: pointer;
  position: relative; /* For dropdown positioning */
  transition: background 0.2s;
}

.user-display:hover {
    background: var(--color-bg-hover);
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

/* Overlay & Teleport Styles */
.overlay-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2147483647; /* Max z-index */
    pointer-events: none;
}

.backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    pointer-events: auto;
}

/* Dropdown Styles */
.profile-dropdown {
    position: fixed; /* Fixed relative to viewport (Teleport) */
    width: 280px;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    z-index: 100;
    overflow: hidden;
    pointer-events: auto;
}

.dropdown-header {
    padding: 16px;
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border);
}

.user-info-large {
    display: flex;
    align-items: center;
    gap: 12px;
}

.user-avatar.large {
    width: 48px;
    height: 48px;
    font-size: 20px;
}

.text-muted {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    word-break: break-all;
}

.dropdown-body {
    padding: 16px;
}

.info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 0.9rem;
}

.info-item:last-child {
    margin-bottom: 0;
}

.label {
    color: var(--color-text-secondary);
}

.value {
    font-weight: 500;
    color: var(--color-text-primary);
}

.badge {
    background: var(--color-bg-tertiary);
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    border: 1px solid var(--color-border);
    text-transform: uppercase;
}

.dropdown-footer {
    padding: 8px;
    border-top: 1px solid var(--color-border);
}

.btn-logout {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border: none;
    background: transparent;
    color: #ef4444; /* Red color */
    cursor: pointer;
    border-radius: var(--radius-md);
    font-weight: 500;
    transition: background 0.15s;
}

.btn-logout:hover {
    background: rgba(239, 68, 68, 0.1);
}

</style>
