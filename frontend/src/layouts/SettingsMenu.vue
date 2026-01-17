<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTheme, useLanguage } from '@/composables/useSettings'

const emit = defineEmits(['close'])
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { isDark, toggle: toggleTheme } = useTheme()
const { lang, toggle: toggleLang, t } = useLanguage()

const userInitials = computed(() => authStore.displayName?.charAt(0)?.toUpperCase() || 'U')

const mainNav = [
  { id: 'chat', label: 'AI Chat', path: '/chat', icon: 'message-square' },
  { id: 'knowledge', label: 'Knowledge Base', path: '/knowledge', icon: 'book' },
  { id: 'admin', label: 'Admin', path: '/admin', icon: 'settings' }
]

const handleLogout = () => {
    authStore.logout()
    router.push('/login')
}

const navigateTo = (path) => {
    router.push(path)
    emit('close')
}
</script>

<template>
  <div class="settings-menu-overlay" @click.self="emit('close')">
    <div class="settings-menu-content">
      <div class="menu-header">
        <h3 class="menu-title">Menu</h3>
        <button class="close-btn" @click="emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <!-- Navigation Links -->
      <nav class="nav-links">
        <div class="section-label">Apps</div>
        <button 
          v-for="item in mainNav" 
          :key="item.id"
          class="nav-btn"
          :class="{ 'active': route.path.startsWith(item.path) }"
          @click="navigateTo(item.path)"
        >
          <div class="icon-box">
             <!-- Chat Icon -->
            <svg v-if="item.icon === 'message-square'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <!-- Book Icon -->
            <svg v-if="item.icon === 'book'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            <!-- Settings Icon -->
            <svg v-if="item.icon === 'settings'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </div>
          <span class="btn-label">{{ item.label }}</span>
          <svg v-if="route.path.startsWith(item.path)" class="check-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
      </nav>

      <div class="divider"></div>

      <!-- App Settings -->
      <div class="settings-group">
        <div class="section-label">Preferences</div>
        
        <button class="setting-item" @click="toggleTheme">
          <div class="setting-left">
            <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            <span>Theme</span>
          </div>
          <span class="setting-value">{{ isDark ? 'Dark' : 'Light' }}</span>
        </button>

        <button class="setting-item" @click="toggleLang">
           <div class="setting-left">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
            <span>Language</span>
          </div>
          <span class="setting-value">{{ lang === 'th' ? 'ไทย' : 'English' }}</span>
        </button>
      </div>

      <div class="divider"></div>

      <button class="logout-btn" @click="handleLogout">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        Sign Out
      </button>

    </div>
  </div>
</template>

<style scoped>
.settings-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
}

.settings-menu-content {
  width: 300px;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  border-top: 1px solid var(--color-border);
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 20px;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

.menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.menu-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  transition: color 0.2s;
}

.close-btn:hover {
  color: var(--color-text-primary);
}

/* User Section */
.user-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding-bottom: 16px;
}

.avatar-large {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  border-radius: 50%;
  border: 3px solid var(--color-bg-secondary);
  box-shadow: 0 0 0 2px #3b82f6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: white;
}

.user-name {
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: 16px;
}

.user-role {
  color: var(--color-text-muted);
  font-size: 13px;
}

/* Divider */
.divider {
  height: 1px;
  background: var(--color-border);
  margin: 16px 0;
}

/* Navigation */
.section-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  margin-bottom: 12px;
  letter-spacing: 0.05em;
}

.nav-links {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.nav-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.nav-btn.active {
  background: var(--color-accent);
  color: white;
}

.nav-btn.active .icon-box {
  color: white;
}

.icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
}

.btn-label {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
}

/* Settings Group */
.settings-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.setting-item:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.setting-left {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 500;
}

.setting-value {
  font-size: 13px;
  color: var(--color-text-muted);
}

/* Logout */
.logout-btn {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: var(--color-error);
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}
</style>
