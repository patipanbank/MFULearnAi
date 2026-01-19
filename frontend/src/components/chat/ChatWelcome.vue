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
        <img src="@/assets/dindin-ai.png" alt="DinDin AI" class="welcome-logo-img" />
      </div>

      <h1>{{ t('welcome') }} {{ userName }}</h1>
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
  width: 120px;
  height: 120px;
  margin: 0 auto 24px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
  box-shadow: var(--shadow-lg);
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
