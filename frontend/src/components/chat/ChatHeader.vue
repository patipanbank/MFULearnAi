<script setup>
defineProps({
  title: { type: String, required: true }
})

const emit = defineEmits(['toggle-sidebar'])
</script>

<template>
  <header class="chat-header">
    <!-- Left: Menu Button -->
    <button class="btn-menu" @click="emit('toggle-sidebar')">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
    
    <!-- Center: User Name -->
    <div class="header-center">
      <h1>{{ title }}</h1>
    </div>
    
    <!-- Right: Spacer -->
    <div class="header-right"></div>
  </header>
</template>

<style scoped>
.chat-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  padding: 0 20px;
  background: var(--color-bg-primary);
  flex-shrink: 0;
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

.header-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-center h1 {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.header-right {
  width: 40px;
}
</style>
