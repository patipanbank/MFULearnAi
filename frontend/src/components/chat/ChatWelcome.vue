<script setup>
defineProps({
  userName: { type: String, default: '' },
  envName: { type: String, default: 'MFULearnAI' },
  t: { type: Function, required: true }
})
</script>

<template>
  <div class="welcome">
    <div class="welcome-content">
      <div class="logo-large">
        <span>🤖</span>
      </div>
      
      <h1>{{ t('welcome') }}{{ userName ? ', ' + userName : '' }}!</h1>
      <p>{{ t('welcomeSub') }}</p>
    </div>
  </div>
</template>

<style scoped>
.welcome {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
}

.welcome-content {
  text-align: center;
}

.logo-large {
  width: 100px;
  height: 100px;
  margin: 0 auto 24px;
  background: var(--color-bg-tertiary);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
}

h1 {
  font-size: 28px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

p {
  font-size: 16px;
  color: var(--color-text-secondary);
}
</style>
