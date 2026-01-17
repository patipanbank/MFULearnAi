<script setup>
import AppSidebar from '@/components/layout/AppSidebar.vue'
</script>

<template>
  <div class="flex h-screen w-screen bg-slate-950 overflow-hidden">
    <!-- Persistent Sidebar -->
    <AppSidebar />
    
    <!-- Main Content Area -->
    <main class="flex-1 min-w-0 relative h-full overflow-hidden">
      <!-- The nested router view will render here (Chat, Knowledge, etc.) -->
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
