<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTheme, useLanguage } from '@/composables/useSettings'

const emit = defineEmits(['close'])
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { isDark, toggle: toggleTheme } = useTheme()
const { lang, toggle: toggleLang, t } = useLanguage()

// ─── Data-driven Navigation ─────────────────────────────────────

/** Main navigation items */
const mainNav = computed(() => [
  { id: 'chat', labelKey: 'aiChat', path: '/chat', icon: 'message-square' },
  { id: 'knowledge', labelKey: 'knowledgeBase', path: '/knowledge', icon: 'book' }
])

/** Admin-only navigation items (visible to superadmin) */
const adminNav = computed(() => [
  { id: 'dashboard', labelKey: 'dashboard', path: '/dashboard', icon: 'layout' },
  { id: 'users', labelKey: 'usersAndAdmins', path: '/dashboard/users', icon: 'users' },
  { id: 'departments', labelKey: 'departments', path: '/dashboard/departments', icon: 'briefcase' },
  { id: 'prompts', labelKey: 'systemPrompts', path: '/dashboard/prompts', icon: 'type' },
  { id: 'api-keys', labelKey: 'apiKeys', path: '/dashboard/api-keys', icon: 'key' },
  { id: 'tools', labelKey: 'toolAccess', path: '/dashboard/tools', icon: 'tool' }
])

const isSuperadmin = computed(() => authStore.user?.role === 'superadmin')

// ─── State ──────────────────────────────────────────────────────

const showLogoutConfirm = ref(false)

// ─── Methods ────────────────────────────────────────────────────

const handleLogout = () => {
    showLogoutConfirm.value = true
}

const confirmLogout = () => {
    authStore.logout()
    showLogoutConfirm.value = false
}

// ── Keyboard support ──
const handleGlobalKeydown = (e) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    if (showLogoutConfirm.value) {
      showLogoutConfirm.value = false
    } else {
      emit('close')
    }
    return
  }
  if (e.key === 'Enter' && showLogoutConfirm.value) {
    const tag = e.target?.tagName?.toLowerCase()
    if (tag !== 'button') {
      e.preventDefault()
      confirmLogout()
    }
  }
}

onMounted(() => document.addEventListener('keydown', handleGlobalKeydown, true))
onUnmounted(() => document.removeEventListener('keydown', handleGlobalKeydown, true))

const navigateTo = (path) => {
    router.push(path)
    emit('close')
}

/**
 * Check if the current route matches a nav item path.
 * Uses startsWith for parent route matching (e.g. /chat matches /chat/123).
 */
const isActive = (path) => route.path.startsWith(path)
</script>

<template>
  <Teleport to="body">
    <div class="settings-menu-overlay" @click.self="emit('close')">
      <div class="settings-menu-content">
        <div class="menu-header">
          <h3 class="menu-title">{{ t('menu') }}</h3>
          <button id="settings-close-btn" class="close-btn" @click="emit('close')" :aria-label="t('cancel')">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <!-- Main Navigation Links -->
        <nav class="nav-links" aria-label="Main navigation">
          <div class="section-label">{{ t('apps') }}</div>
          <button 
            v-for="item in mainNav" 
            :key="item.id"
            :id="`nav-${item.id}`"
            class="nav-btn"
            :class="{ 'active': isActive(item.path) }"
            @click="navigateTo(item.path)"
          >
            <div class="icon-box">
               <!-- Chat Icon -->
              <svg v-if="item.icon === 'message-square'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              <!-- Book Icon -->
              <svg v-else-if="item.icon === 'book'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            </div>
            <span class="btn-label">{{ t(item.labelKey) }}</span>
            <svg v-if="isActive(item.path)" class="check-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
        </nav>

        <!-- Admin Tools (Superadmin Only) -->
        <nav v-if="isSuperadmin" class="nav-links admin-nav" aria-label="Admin navigation">
          <div class="section-label">{{ t('adminTools') }}</div>
          
          <button 
            v-for="item in adminNav"
            :key="item.id"
            :id="`nav-admin-${item.id}`"
            class="nav-btn" 
            :class="{ 'active': route.path === item.path }" 
            @click="navigateTo(item.path)"
          >
              <div class="icon-box">
                  <!-- Layout/Dashboard Icon -->
                  <svg v-if="item.icon === 'layout'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                  <!-- Users Icon -->
                  <svg v-else-if="item.icon === 'users'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                  <!-- Briefcase/Department Icon -->
                  <svg v-else-if="item.icon === 'briefcase'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                  <!-- Type/Prompt Icon -->
                  <svg v-else-if="item.icon === 'type'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
                  <!-- Key Icon -->
                  <svg v-else-if="item.icon === 'key'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
                  <!-- Tool/Wrench Icon -->
                  <svg v-else-if="item.icon === 'tool'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
              </div>
              <span class="btn-label">{{ t(item.labelKey) }}</span>
          </button>
        </nav>

        <div class="divider"></div>

        <!-- App Settings -->
        <div class="settings-group">
          <div class="section-label">{{ t('preferences') }}</div>
          
          <button id="toggle-theme-btn" class="setting-item" @click="toggleTheme">
            <div class="setting-left">
              <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              <span>{{ t('theme') }}</span>
            </div>
            <span class="setting-value">{{ isDark ? t('dark') : t('light') }}</span>
          </button>

          <button id="toggle-lang-btn" class="setting-item" @click="toggleLang">
             <div class="setting-left">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              <span>{{ t('language') }}</span>
            </div>
            <span class="setting-value">{{ lang.toUpperCase() }}</span>
          </button>
        </div>

        <div class="divider"></div>

        <button id="logout-btn" class="logout-btn" @click="handleLogout">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          <span>{{ t('logout') }}</span>
        </button>

      </div>
    </div>

    <!-- Logout Confirmation Modal -->
    <div v-if="showLogoutConfirm" class="confirmation-overlay" @click.self="showLogoutConfirm = false">
      <div class="confirmation-modal">
        <h3 class="confirmation-title">{{ t('confirmLogoutTitle') }}</h3>
        <p class="confirmation-message">{{ t('confirmLogoutMessage') }}</p>
        <div class="confirmation-actions">
          <button id="cancel-logout-btn" class="action-btn cancel" @click="showLogoutConfirm = false">
            {{ t('cancel') }}
          </button>
          <button id="confirm-logout-btn" class="action-btn confirm" @click="confirmLogout">
            {{ t('confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: 100svh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
}

.settings-menu-content {
  width: 300px;
  max-width: 85vw;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  border-top: 1px solid var(--color-border);
  height: 100vh;
  height: 100svh;
  display: flex;
  flex-direction: column;
  padding: 20px 16px;
  padding-bottom: env(safe-area-inset-bottom, 20px);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  overflow-y: auto;
}

@media (max-width: 480px) {
  .settings-menu-content {
    width: 100vw;
    max-width: none;
    border-radius: 0;
  }
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

.admin-nav {
  margin-top: 16px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
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
  flex-shrink: 0;
}

.btn-label {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  padding: 12px 16px;
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}

.check-icon {
  width: 16px;
  height: 16px;
  color: var(--color-accent);
  margin-left: auto;
  flex-shrink: 0;
}

/* Logout */
.logout-btn {
  margin-top: auto;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: var(--color-error, #ef4444);
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

/* Confirmation Modal */
.confirmation-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;
}

.confirmation-modal {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 24px;
  width: 90%;
  max-width: 320px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.confirmation-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.confirmation-message {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0 0 24px 0;
  line-height: 1.5;
}

.confirmation-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.action-btn.cancel {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.action-btn.cancel:hover {
  background: var(--color-bg-hover);
}

.action-btn.confirm {
  background: var(--color-error, #ef4444);
  color: white;
  box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);
}

.action-btn.confirm:hover {
  filter: brightness(90%);
  transform: translateY(-1px);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
