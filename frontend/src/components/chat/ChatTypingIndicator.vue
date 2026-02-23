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
  gap: 5px;
  align-items: center;
}

.dots span {
  width: 6px;
  height: 6px;
  background: var(--color-text-muted);
  border-radius: 50%;
  animation: typing-wave 1.4s ease-in-out infinite;
}

.dots span:nth-child(1) { animation-delay: 0s; }
.dots span:nth-child(2) { animation-delay: 0.15s; }
.dots span:nth-child(3) { animation-delay: 0.3s; }

@keyframes typing-wave {
  0%, 100% {
    transform: translateY(0);
    opacity: 0.35;
  }
  50% {
    transform: translateY(-5px);
    opacity: 1;
  }
}

.text {
  font-size: 13px;
  color: var(--color-text-muted);
  animation: text-fade 2s ease-in-out infinite;
}

@keyframes text-fade {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
</style>
