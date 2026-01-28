<script setup>
import { ref, computed } from 'vue'
import { useLanguage } from '@/composables/useSettings'
import { useRouter } from 'vue-router'

const { t } = useLanguage()
const router = useRouter()
const envName = import.meta.env.VITE_ENV_NAME || 'MFULearnAI'
const envType = import.meta.env.VITE_ENV_TYPE || 'TEST'

const isTestEnv = computed(() => envType === 'TEST')

// Admin Login Logic
const showAdmin = ref(false) // Toggle between SSO and Admin
const adminUsername = ref('')
const adminPassword = ref('')
const loading = ref(false)
const errorMsg = ref('')

const toggleAdmin = () => {
  showAdmin.value = !showAdmin.value
  errorMsg.value = ''
}

const handleAdminLogin = async () => {
  if (!adminUsername.value || !adminPassword.value) return
  
  loading.value = true
  errorMsg.value = ''

  try {
    const res = await fetch('/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: adminUsername.value, 
        password: adminPassword.value 
      })
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Login failed')
    }

    // Success
    // Store token / user data logic similar to AuthCallback (simplified here)
    // In a real app, use an auth store. Using localStorage for quick parity.
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('user_data', JSON.stringify(data.user))
    
    // Redirect
    window.location.href = '/admin/users' // Redirect to Admin Dashboard
    
  } catch (e) {
    errorMsg.value = e.message
  } finally {
    loading.value = false
  }
}
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

      <!-- Main Content Area -->
      <div class="login-content">
        
        <!-- Standard SSO Login (Default) -->
        <div v-if="!showAdmin" class="login-buttons">
          <a href="/api/auth/login/mfu" class="btn-login btn-mfu">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            {{ t('loginWithMFU') || 'Login with MFU SSO' }}
          </a>
        </div>

        <!-- Admin Login Form -->
        <div v-else class="admin-form">
          <div class="form-group">
            <label>Username</label>
            <input v-model="adminUsername" type="text" placeholder="Admin Username" @keyup.enter="handleAdminLogin">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input v-model="adminPassword" type="password" placeholder="Password" @keyup.enter="handleAdminLogin">
          </div>
          
          <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

          <button class="btn-login btn-primary" :disabled="loading" @click="handleAdminLogin">
            <span v-if="loading">...</span>
            <span v-else>Login</span>
          </button>
        </div>

        <!-- Toggle Link -->
        <div class="toggle-wrapper">
          <button class="btn-text" @click="toggleAdmin">
            {{ showAdmin ? 'Back to Student/Staff Login' : 'Admin Access' }}
          </button>
        </div>

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
  display: flex;
  flex-direction: column;
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
  gap: 12px;
}

.admin-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}

.form-group label {
  font-size: 14px;
  color: var(--color-text-muted);
  font-weight: 500;
}

.form-group input {
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-input);
  color: var(--color-text);
  font-family: inherit;
  transition: all 0.2s;
}

.form-group input:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
  cursor: pointer;
  border: none;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.btn-login:hover:not(:disabled) {
  transform: translateY(-2px);
}

.btn-login:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-login .icon {
  width: 20px;
  height: 20px;
}

.btn-mfu {
  background: linear-gradient(135deg, #ad2125, #880000); /* MFU Colors */
  color: white;
  box-shadow: 0 4px 15px rgba(173, 33, 37, 0.3);
}

.btn-mfu:hover {
  box-shadow: 0 8px 25px rgba(173, 33, 37, 0.4);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-text {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: pointer;
  text-decoration: underline;
  padding: 8px;
  margin-top: 12px;
}

.btn-text:hover {
  color: var(--color-primary);
}

.error-msg {
  color: #ef4444;
  font-size: 14px;
  text-align: center;
  background: rgba(239, 68, 68, 0.1);
  padding: 8px;
  border-radius: 8px;
}

.toggle-wrapper {
  text-align: center;
  margin-top: 16px;
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
