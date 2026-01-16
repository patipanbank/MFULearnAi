<script setup>
defineProps({
  t: { type: Function, required: true }
})
</script>

<template>
  <div class="typing">
    <div class="typing-avatar">🤖</div>
    <div class="typing-content">
      <div class="dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span class="text">{{ t('thinking') }}</span>
    </div>
  </div>
</template>

<style scoped>
.typing {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-left: 0;
}

.typing-avatar {
  width: 32px;
  height: 32px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.typing-content {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.dots {
  display: flex;
  gap: 4px;
}

.dots span {
  width: 6px;
  height: 6px;
  background: var(--color-text-muted);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.dots span:nth-child(1) { animation-delay: -0.32s; }
.dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.text {
  font-size: 13px;
  color: var(--color-text-muted);
}
</style>
