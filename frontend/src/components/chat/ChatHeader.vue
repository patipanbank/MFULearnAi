<script setup>
defineProps({
  envName: {
    type: String,
    default: 'MFULearnAI'
  },
  modelName: {
    type: String,
    default: 'Claude 3.5'
  }
})

const emit = defineEmits(['toggle-sidebar'])
</script>

<template>
  <header class="chat-header glass">
    <button class="btn-toggle" @click="emit('toggle-sidebar')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
    
    <div class="header-title">
      <h1>{{ envName }}</h1>
      <span class="model-badge">{{ modelName }}</span>
    </div>
    
    <div class="header-actions">
      <slot name="actions">
        <button class="btn-icon" title="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </slot>
    </div>
  </header>
</template>

<style scoped>
.chat-header {
  height: var(--header-height, 64px);
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid var(--glass-border);
}

.btn-toggle, .btn-icon {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-toggle:hover, .btn-icon:hover {
  background: rgba(255, 255, 255, 0.1);
}

.btn-toggle svg, .btn-icon svg {
  width: 20px;
  height: 20px;
}

.header-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title h1 {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.model-badge {
  padding: 4px 10px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  color: white;
}

.header-actions {
  display: flex;
  gap: 8px;
}
</style>
