<script setup>
</script>

<template>
  <div class="typing-indicator">
    <div class="message-avatar">
      <div class="avatar-ring pulse">
        <span>🤖</span>
      </div>
    </div>
    <div class="typing-bubble">
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span class="typing-text">กำลังคิด...</span>
    </div>
  </div>
</template>

<style scoped>
.typing-indicator {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.message-avatar {
  flex-shrink: 0;
}

.avatar-ring {
  width: 40px;
  height: 40px;
  background: var(--glass-bg);
  border: 2px solid var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.avatar-ring.pulse {
  animation: ring-pulse 1.5s ease-in-out infinite;
}

@keyframes ring-pulse {
  0%, 100% { border-color: var(--color-primary); }
  50% { border-color: var(--color-accent); }
}

.typing-bubble {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  width: 8px;
  height: 8px;
  background: var(--color-primary);
  border-radius: 50%;
  animation: typing-bounce 1.4s infinite ease-in-out both;
}

.typing-dots span:nth-child(1) { animation-delay: -0.32s; }
.typing-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.typing-text {
  font-size: 13px;
  color: var(--color-text-muted);
}
</style>
