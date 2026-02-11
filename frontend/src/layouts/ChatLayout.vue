<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useLanguage } from '@/composables/useSettings'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'

const authStore = useAuthStore()
const { t } = useLanguage()

// State
const isMobile = ref(false)
const isSidebarOpen = ref(false) // For mobile overlay

// Props for Header
const envName = import.meta.env.VITE_ENV_NAME || t('appName')
const userName = computed(() => authStore.displayName || t('guest'))
const userInitial = computed(() => authStore.displayName?.charAt(0)?.toUpperCase() || 'U')

const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024
  if (!isMobile.value) {
    isSidebarOpen.value = false // Reset on desktop
  }
}

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const closeSidebar = () => {
  isSidebarOpen.value = false
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<template>
  <div class="chat-layout-container">
    <!-- Sidebar with Mobile Props -->
    <AppSidebar 
        :is-mobile="isMobile"
        :mobile-open="isSidebarOpen"
        @close-mobile="closeSidebar"
    />
    
    <!-- Mobile Overlay Backdrop -->
    <div 
        v-if="isMobile && isSidebarOpen" 
        class="sidebar-backdrop"
        @click="closeSidebar"
    ></div>

    <main class="chat-main-content">
      <AppHeader 
        :env-name="envName"
        :user-name="userName"
        :user-initial="userInitial"
        :user-avatar-url="authStore.profilePicture"
        :show-sidebar-toggle="isMobile"
        @toggle-sidebar="toggleSidebar"
      />
      <div class="content-view">
        <router-view />
      </div>
    </main>
  </div>
</template>

<style scoped>
.chat-layout-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: var(--color-bg-primary);
}

.chat-main-content {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: visible;
  position: relative;
  display: flex;
  flex-direction: column;
}

.content-view {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* Mobile Backdrop */
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 45; /* Below sidebar (50) but above content */
  backdrop-filter: blur(2px);
}
</style>
