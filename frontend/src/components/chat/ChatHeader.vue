<script setup>
import { ref } from 'vue'

const props = defineProps({
  envName: { type: String, default: 'MFULearnAI' }, // Title on Left
  userName: { type: String, default: 'User' },
  userInitial: { type: String, default: 'U' },
  isDark: { type: Boolean, default: true },
  lang: { type: String, default: 'th' },
  t: { type: Function, required: true }
})

const emit = defineEmits([
  'toggle-sidebar', 
  'toggle-theme', 
  'toggle-lang', 
  'logout'
])

const showUserMenu = ref(false)
const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}
const closeUserMenu = () => {
  showUserMenu.value = false
}
</script>

<template>
  <header class="chat-header">
    <!-- LEFT: Burger + Title (MFULearnAI) -->
    <div class="header-left">
      <button class="btn-menu" @click="emit('toggle-sidebar')">
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
    </div>
    
    <!-- RIGHT: User Dropdown -->
    <div class="header-right">
      <div class="user-dropdown" v-click-outside="closeUserMenu">
        <button class="btn-user" @click="toggleUserMenu" :class="{ active: showUserMenu }">
          <div class="user-avatar">{{ userInitial }}</div>
          <span class="user-name">{{ userName }}</span>
          <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ rotated: showUserMenu }">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        
        <Transition name="dropdown">
          <div v-if="showUserMenu" class="dropdown-menu">
            <!-- Theme -->
            <button class="menu-item" @click="emit('toggle-theme')">
              <svg v-if="isDark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
              <span>{{ isDark ? 'Light Mode' : 'Dark Mode' }}</span>
            </button>
            
            <!-- Language -->
            <button class="menu-item" @click="emit('toggle-lang')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span>{{ lang === 'th' ? 'English' : 'ภาษาไทย' }}</span>
            </button>
            
            <div class="divider"></div>
            
            <!-- Logout -->
            <button class="menu-item danger" @click="emit('logout')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>{{ t('logout') }}</span>
            </button>
          </div>
        </Transition>
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
  padding: 0 20px;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  position: relative;
  z-index: 50;
}

/* Left Section */
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
  border: none;
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
  gap: 8px;
}

.logo-emoji {
  font-size: 24px;
}

.app-brand h1 {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.5px;
}

/* Right Section - User Dropdown */
.header-right {
  display: flex;
  align-items: center;
}

.user-dropdown {
  position: relative;
}

.btn-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-user:hover, .btn-user.active {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
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
}

.chevron {
  color: var(--color-text-muted);
  transition: transform 0.2s;
}

.chevron.rotated {
  transform: rotate(180deg);
}

/* Dropdown Menu */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 200px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.menu-item:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.menu-item.danger {
  color: var(--color-error);
}

.menu-item.danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}

/* Transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Responsive */
@media (max-width: 640px) {
  .user-name {
    display: none;
  }
}
</style>
