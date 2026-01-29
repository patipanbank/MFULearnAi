<script setup>
import { computed } from 'vue'
import { useLanguage } from '@/composables/useSettings'

const { t } = useLanguage()
const envName = import.meta.env.VITE_ENV_NAME || 'MFULearnAI'
const envType = import.meta.env.VITE_ENV_TYPE || 'TEST'

const isTestEnv = computed(() => envType === 'TEST')
</script>

<template>
  <div class="login-container">
    <div class="login-card fade-in">
      <!-- Logo & Title -->
      <div class="login-header">
        <div class="logo-wrapper">
          <div class="logo-icon">🤖</div>
        </div>
        <h1 class="app-title">{{ envName }}</h1>
        <p class="app-subtitle">{{ t('appSubtitle') }}</p>
        <span v-if="isTestEnv" class="env-badge">{{ t('stagingEnv') }}</span>
      </div>

      <!-- Login Buttons -->
      <div class="login-buttons">
        <a href="/api/auth/login/sso" class="btn-login btn-mfu">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          {{ t('loginSSO') || 'Login with MFU SSO' }}
        </a>
      </div>

      <!-- Footer -->
      <div class="login-footer">
        <p class="pdpa-notice">
          {{ t('agreeTo') }} 
          <a href="#">{{ t('terms') }}</a> {{ t('and') }} <a href="#">{{ t('pdpa') }}</a>.
        </p>
      </div>
    </div>
    
    <!-- Background Decoration -->
    <div class="bg-decoration">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-dark);
  position: relative;
  overflow: hidden;
}

.login-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 24px;
  padding: 48px;
  width: 100%;
  max-width: 420px;
  position: relative;
  z-index: 10;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo-wrapper {
  width: 80px;
  height: 80px;
  margin: 0 auto 16px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
}

.logo-icon {
  font-size: 40px;
}

.app-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 8px;
}

.app-subtitle {
  color: var(--color-text-muted);
  font-size: 14px;
}

.env-badge {
  display: inline-block;
  margin-top: 12px;
  padding: 4px 12px;
  background: rgba(139, 92, 246, 0.2);
  border: 1px solid var(--color-accent);
  border-radius: 12px;
  font-size: 12px;
  color: var(--color-accent);
}

.login-buttons {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.btn-login {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 14px 24px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 15px;
  text-decoration: none;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  cursor: pointer;
}

.btn-login:hover {
  transform: translateY(-2px);
}

.btn-login .icon {
  width: 20px;
  height: 20px;
}

.btn-mfu {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  color: white; /* Always white on gradient */
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
  border: none;
}

.btn-mfu:hover {
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
}

.admin-login-wrapper {
  text-align: center;
}

.link-admin {
  font-size: 14px;
  color: var(--color-text-muted);
  text-decoration: none;
  transition: color 0.2s;
}

.link-admin:hover {
  color: var(--color-primary);
  text-decoration: underline;
}

.login-footer {
  margin-top: 32px;
  text-align: center;
}

.pdpa-notice {
  font-size: 12px;
  color: var(--color-text-muted);
}

.pdpa-notice a {
  color: var(--color-primary);
  text-decoration: none;
}

.pdpa-notice a:hover {
  text-decoration: underline;
}

/* Background Decoration */
.bg-decoration {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.1;
}

.circle-1 {
  width: 600px;
  height: 600px;
  background: var(--color-primary);
  top: -200px;
  right: -200px;
}

.circle-2 {
  width: 400px;
  height: 400px;
  background: var(--color-accent);
  bottom: -100px;
  left: -100px;
}

.circle-3 {
  width: 200px;
  height: 200px;
  background: var(--color-primary);
  bottom: 20%;
  right: 10%;
}
</style>
