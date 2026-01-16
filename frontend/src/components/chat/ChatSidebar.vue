<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const isMobile = ref(false)
const isHovering = ref(false)

// Check mobile on mount & resize
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('keydown', handleKeydown)
})

const handleKeydown = (e) => {
  // Ctrl+B or Cmd+B to toggle sidebar
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault()
    toggleSidebar()
  }
}

// Hover Logic
const handleMouseEnter = () => {
  if (!props.modelValue && !isMobile.value) {
    isHovering.value = true
  }
}
const handleMouseLeave = () => {
  isHovering.value = false
}

// Effective Expanded State (Model OR Hover)
const isEffectivelyExpanded = computed(() => {
  if (isMobile.value) return props.modelValue
  return props.modelValue || isHovering.value
})

const sidebarClasses = computed(() => {
  const base = []
  if (isMobile.value) {
    base.push('mobile-sidebar')
    base.push(props.modelValue ? 'translate-x-0' : '-translate-x-full')
  } else {
    // Desktop: Expanded or Collapsed
    base.push(isEffectivelyExpanded.value ? 'w-expanded' : 'w-collapsed')
    // Add shadow if hovering in collapsed mode (floating effect)
    if (!props.modelValue && isHovering.value) base.push('floating-expand')
  }
  return base
})
</script>

<template>
  <!-- Mobile Backdrop -->
  <div 
    v-if="isMobile && modelValue" 
    class="mobile-backdrop"
    @click="toggleSidebar"
  ></div>

  <!-- Main Sidebar Element -->
  <aside 
    class="sidebar-container"
    :class="sidebarClasses"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div class="sidebar-content">
      
      <!-- top: New Chat -->
      <div class="section-top">
        <button 
          class="btn-new-chat" 
          @click="emit('new-chat')"
          :title="t('newChat')"
        >
          <div class="icon-wrapper">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <span 
            class="label-text" 
            :class="{ 'opacity-0': !isEffectivelyExpanded }"
          >
            {{ t('newChat') }}
          </span>
        </button>
      </div>

      <!-- middle: Chat List -->
      <div class="section-list">
        <div class="list-header" :class="{ 'opacity-0': !isEffectivelyExpanded }">
          {{ t('recentChats') }}
        </div>
        
        <div class="scroll-area">
          <button 
            v-for="session in sessions.slice(0, 10)" 
            :key="session.sessionId"
            class="list-item"
            :class="{ 'active': session.sessionId === currentSessionId }"
            @click="emit('select-session', session.sessionId)"
            :title="!isEffectivelyExpanded ? ('Chat ' + (session.metadata?.messageCount || '0')) : ''"
          >
            <!-- Active Indicator -->
            <div class="active-indicator" v-if="session.sessionId === currentSessionId"></div>

            <div class="icon-wrapper item-icon">
              <!-- Chat Bubble Icon -->
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
              </svg>
            </div>
            <span 
              class="label-text list-text" 
              :class="{ 'opacity-0': !isEffectivelyExpanded }"
            >
              Chat {{ session.metadata?.messageCount || 0 }}
            </span>
          </button>
        </div>
      </div>

      <!-- bottom: Settings -->
      <div class="section-bottom">
        <div class="settings-container" v-click-outside="closeSettings">
          
          <!-- Popup Menu (Absolute) -->
          <Transition name="fade-up">
            <div v-if="showSettings" class="settings-popup">
              <!-- Theme -->
              <button class="popup-item" @click="emit('toggle-theme')">
                <svg v-if="isDark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
                <span>{{ isDark ? 'Light Mode' : 'Dark Mode' }}</span>
              </button>
              
              <!-- Lang -->
              <button class="popup-item" @click="emit('toggle-lang')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                <span>{{ lang === 'th' ? 'English' : 'ภาษาไทย' }}</span>
              </button>
              
              <div class="divider"></div>
              
              <!-- Logout -->
              <button class="popup-item danger" @click="emit('logout')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>{{ t('logout') }}</span>
              </button>
            </div>
          </Transition>

          <!-- Main Settings Button -->
          <button 
            class="btn-settings" 
            :class="{ 'active': showSettings }"
            @click="toggleSettings"
            :title="t('settings')"
          >
            <div class="icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </div>
            <span 
              class="label-text" 
              :class="{ 'opacity-0': !isEffectivelyExpanded }"
            >
              {{ t('settings') }}
            </span>
          </button>
        </div>
      </div>

    </div>
  </aside>
</template>

<style scoped>
/* Container Layout */
.sidebar-container {
  height: 100vh;
  background-color: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0; /* Important! Prevent shrinking beyond defined width */
  transition: width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.3s;
  overflow: visible; /* Must check this carefully, usually hidden but popup needs visible */
  position: relative;
  z-index: 100;
}

/* Width Control */
.w-expanded {
  width: 260px;
}
.w-collapsed {
  width: 64px;
}

/* Hover Floating Effect - Expands over content */
.floating-expand {
  position: absolute; /* Float over */
  width: 260px; /* Full width */
  left: 0;
  top: 0;
  height: 100vh;
  box-shadow: 4px 0 24px rgba(0,0,0,0.15); /* Drop shadow */
  z-index: 200;
  border-right: 1px solid var(--color-border);
}

/* Mobile Styles */
.mobile-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 280px; /* Wider for mobile touch */
  height: 100vh;
  z-index: 1000;
  transition: transform 0.3s ease-in-out;
  box-shadow: 4px 0 20px rgba(0,0,0,0.2);
}
.translate-x-0 { transform: translateX(0); }
.-translate-x-full { transform: translateX(-100%); }

.mobile-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(2px);
  z-index: 999;
  animation: fadeIn 0.3s;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Internal Content Structure */
/* Internal Content Structure */
.sidebar-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: visible; /* Allow popup to extend beyond sidebar */
  width: 100%;
}

/* Top New Chat */
.section-top {
  padding: 12px;
  transition: padding 0.3s;
}

.sidebar-container.w-collapsed .section-top {
  padding-left: 0;
  padding-right: 0;
  display: flex;
  justify-content: center;
}
/* Exception for Floating Hover: Reset padding */
.sidebar-container.floating-expand .section-top {
  padding: 12px;
  display: block;
}

.btn-new-chat {
  width: 100%;
  height: 44px;
  background-color: var(--color-accent);
  color: white;
  border: none;
  border-radius: 12px;
  display: flex;
  align-items: center;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s;
  padding: 0;
}

.sidebar-container.w-collapsed .btn-new-chat {
  width: 44px; /* Make it square-ish or just centered */
  border-radius: 12px;
}
.sidebar-container.floating-expand .btn-new-chat {
  width: 100%; /* Restore width on hover */
}

.btn-new-chat:hover {
  background-color: var(--color-accent-hover);
}

/* Common Icon Wrapper to ensure alignment */
.icon-wrapper {
  width: 44px; /* Match button height/icon area, not full sidebar width yet */
  height: 100%;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
/* In expanded mode, we might want it larger or just left aligned? 
   Actually original code had 64px width. Let's make it consistent.
*/ 
.sidebar-container.w-expanded .icon-wrapper,
.sidebar-container.floating-expand .icon-wrapper,
.sidebar-container.mobile-sidebar .icon-wrapper {
  width: 52px; /* Slightly larger in expanded for spacing */
}
.sidebar-container.w-expanded .btn-new-chat,
.sidebar-container.mobile-sidebar .btn-new-chat {
  width: 100%;
}

/* Text Labels */
.label-text {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  opacity: 1;
  transition: opacity 0.2s;
  pointer-events: none;
}
.opacity-0 {
  opacity: 0;
  width: 0; 
}

/* List Section */
.section-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 8px;
  transition: padding 0.3s;
}

.sidebar-container.w-collapsed .section-list {
  padding-left: 0;
  padding-right: 0;
  align-items: center; /* Center items in the list */
}
.sidebar-container.floating-expand .section-list {
  padding: 0 8px;
  align-items: stretch;
}

.list-header {
  height: 32px;
  display: flex;
  align-items: center;
  padding-left: 12px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  white-space: nowrap;
  transition: opacity 0.2s;
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center; /* Important for collapsed centering */
}

.sidebar-container.w-expanded .scroll-area,
.sidebar-container.floating-expand .scroll-area,
.sidebar-container.mobile-sidebar .scroll-area {
  display: block; /* Return to block for full width items */
}

.list-item {
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: background-color 0.15s;
  margin-bottom: 2px;
  padding: 0;
  overflow: hidden;
  position: relative; /* For indicator */
}

.sidebar-container.w-collapsed .list-item {
  width: 44px; /* Square items */
  justify-content: center;
  border-radius: 12px;
}
.sidebar-container.floating-expand .list-item {
  width: 100%; /* Restore */
  justify-content: flex-start;
}

.list-item:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.list-item.active {
  background-color: var(--color-accent-light);
  color: var(--color-accent);
}

/* Active Indicator */
.active-indicator {
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  background: var(--color-accent);
  border-radius: 0 4px 4px 0;
}

.item-icon {
  width: 44px; /* Match standard icon size */
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.list-text {
  padding-right: 12px;
  white-space: nowrap;
}

/* Bottom Section */
.section-bottom {
  padding: 12px;
  border-top: 1px solid var(--color-border);
  transition: padding 0.3s;
}

.sidebar-container.w-collapsed .section-bottom {
  padding-left: 0;
  padding-right: 0;
  display: flex;
  justify-content: center;
}
.sidebar-container.floating-expand .section-bottom {
  padding: 12px;
  display: block;
}

.settings-container {
  position: relative;
  width: 100%; /* Default full width */
  display: flex;
  justify-content: center; /* Default center for button inside */
}

.sidebar-container.w-expanded .settings-container,
.sidebar-container.floating-expand .settings-container,
.sidebar-container.mobile-sidebar .settings-container {
  display: block; /* Block for full width button */
}

.btn-settings {
  width: 100%;
  height: 44px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 12px;
  display: flex;
  align-items: center;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all 0.2s;
  padding: 0;
  overflow: hidden;
}

.sidebar-container.w-collapsed .btn-settings {
  width: 44px;
  justify-content: center;
}

.btn-settings:hover, .btn-settings.active {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

/* Settings Popup */
.settings-popup {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 8px;
  width: 220px;
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 8px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 200;
}

.popup-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  width: 100%;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s;
}

.popup-item:hover {
  background-color: var(--color-bg-hover);
}

.popup-item.danger {
  color: var(--color-error);
}
.popup-item.danger:hover {
  background-color: rgba(239, 68, 68, 0.1);
}

.divider {
  width: 100%;
  height: 1px;
  background-color: var(--color-border);
  margin: 4px 0;
}

/* Transitions */
.fade-up-enter-active,
.fade-up-leave-active {
  transition: all 0.2s ease;
}

.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
