<script setup>
import AppSidebar from '@/components/layout/AppSidebar.vue'
</script>

<template>
  <div class="chat-layout-container">
    <AppSidebar />
    <main class="chat-main-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.chat-layout-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: #0f172a;
}

.chat-main-content {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  position: relative;
}
</style>
