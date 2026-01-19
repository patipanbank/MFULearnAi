<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLanguage } from '@/composables/useSettings'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useLanguage()

const envName = import.meta.env.VITE_ENV_NAME || 'MFULearnAI'
const envType = import.meta.env.VITE_ENV_TYPE || 'TEST'

const isTestEnv = computed(() => envType === 'TEST')

// Admin Login State
const showAdminLogin = ref(false)
const adminUsername = ref('')
const adminPassword = ref('')
const loginError = ref('')
const isLoading = ref(false)

const handleAdminLogin = async () => {
    if (!adminUsername.value || !adminPassword.value) return
    
    isLoading.value = true
    loginError.value = ''
    
    try {
        await authStore.loginAdmin(adminUsername.value, adminPassword.value)
        router.push('/chat')
    } catch (error) {
        loginError.value = error.response?.data?.error || 'Login failed'
    } finally {
        isLoading.value = false
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

      <!-- Login Buttons -->
      <!-- View 1: SSO Options -->
      <div v-if="!showAdminLogin" class="view-transition">
          <div class="login-buttons">
            <a href="/api/auth/login/google" class="btn-login btn-google">
              <svg class="icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {{ t('loginGoogle') }}
            </a>
          </div>

          <div class="divider">
            <span>or</span>
          </div>

          <div class="text-center mt-2">
            <button @click="showAdminLogin = true" class="text-link-secondary">
                Log in with Admin credentials
            </button>
          </div>
      </div>

      <!-- View 2: Admin Form (Integrated) -->
      <div v-else class="view-transition">
          <div class="admin-form-integrated">
              <div class="form-group">
                  <label>Username</label>
                  <input v-model="adminUsername" type="text" class="form-input" placeholder="Admin Username" @keyup.enter="handleAdminLogin" />
              </div>
              <div class="form-group">
                  <label>Password</label>
                  <input v-model="adminPassword" type="password" class="form-input" placeholder="Password" @keyup.enter="handleAdminLogin" />
              </div>
              
              <div v-if="loginError" class="error-msg">{{ loginError }}</div>
              
              <button @click="handleAdminLogin" :disabled="isLoading" class="btn-login btn-mfu w-full mb-3">
                  {{ isLoading ? 'Logging in...' : 'Login' }}
              </button>

              <button @click="showAdminLogin = false" class="text-link-secondary w-full">
                  &larr; Back to SSO Login
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
  color: white;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
}

.btn-mfu:hover {
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
}

.btn-google {
  background: white;
  color: #333;
  border: 1px solid #ddd;
}

.btn-google:hover {
  background: #f8f8f8;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.divider {
    display: flex; align-items: center; justify-content: center; margin: 16px 0;
    position: relative;
    color: var(--color-text-muted); font-size: 13px;
}
.divider::before, .divider::after {
    content: ""; flex: 1; height: 1px; background: var(--color-border);
}
.divider span { padding: 0 12px; }

.text-link-secondary {
    background: none; border: none; color: var(--color-text-muted); font-size: 13px; cursor: pointer;
    text-decoration: underline; transition: color 0.2s;
}
.text-link-secondary:hover { color: var(--color-accent); }

.w-full { width: 100%; }
.mb-3 { margin-bottom: 12px; }
.text-center { text-align: center; }

/* Form Styles */
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-size: 13px; color: var(--color-text-secondary); }
.form-input { 
    width: 100%; padding: 12px; background: var(--color-bg-dark); border: 1px solid var(--color-border);
    border-radius: 12px; color: var(--color-text); outline: none; transition: border 0.2s;
}
.form-input:focus { border-color: var(--color-accent); }
.error-msg { color: #ef4444; font-size: 13px; text-align: center; margin-bottom: 12px; }

/* Transition Animation */
.view-transition { animation: fadeIn 0.3s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); }}

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
