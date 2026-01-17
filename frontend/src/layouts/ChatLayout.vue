<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useLanguage } from '@/composables/useSettings'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'

const authStore = useAuthStore()
const { t } = useLanguage()

// Props for Header
const envName = import.meta.env.VITE_ENV_NAME || t('appName')
const userName = computed(() => authStore.displayName || t('guest'))
const userInitial = computed(() => authStore.displayName?.charAt(0)?.toUpperCase() || 'U')
</script>

<template>
  <div class="chat-layout-container">
    <AppSidebar />
    <main class="chat-main-content">
      <AppHeader 
        :env-name="envName"
        :user-name="userName"
        :user-initial="userInitial"
        :show-sidebar-toggle="false"
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
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.content-view {
  flex: 1;
  overflow: hidden;
  position: relative;
}
</style>
