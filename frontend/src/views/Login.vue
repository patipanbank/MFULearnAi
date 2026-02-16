<script setup>
import { ref, computed, onMounted } from 'vue'
import { useLanguage, useTheme } from '@/composables/useSettings'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth' // Assuming auth store exists
import axios from 'axios'
import dindinLogo from '@/assets/dindin-ai.png' // Import explicitly to ensure Vite handles it

// Import background images
import bg0600 from '@/assets/0600.jpg'
import bg1200 from '@/assets/1200.jpg'
import bg1600 from '@/assets/1600.jpg'
import bg1900 from '@/assets/1900.jpg'

const { t } = useLanguage()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const envName = import.meta.env.VITE_ENV_NAME || 'MFULearnAI'
// const envType = import.meta.env.VITE_ENV_TYPE || 'TEST' // Staging badge removed

// Background Image Logic
const getBackgroundImage = () => {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 12) return bg0600
    if (hour >= 12 && hour < 16) return bg1200
    if (hour >= 16 && hour < 19) return bg1600
    return bg1900
}

const currentBg = ref(getBackgroundImage())

// Admin Login Logic
const isAdminMode = computed(() => route.query.mode === 'admin')
const adminUsername = ref('')
const adminPassword = ref('')
const isLoading = ref(false)
const errorMsg = ref('')

const handleAdminLogin = async () => {
    if (!adminUsername.value || !adminPassword.value) return
    
    isLoading.value = true
    errorMsg.value = ''
    
    try {
        // Call Identity Service directly via Gateway
        const response = await axios.post('/api/auth/admin/login', {
            username: adminUsername.value,
            password: adminPassword.value
        })
        
        const { token, user } = response.data
        authStore.setAuth(token, user)
        localStorage.setItem('auth_provider', 'admin')
        router.push('/admin') // Redirect to admin dashboard
    } catch (err) {
        console.error('Admin Login Failed', err)
        errorMsg.value = 'Invalid credentials'
    } finally {
        isLoading.value = false
    }
    } finally {
        isLoading.value = false
    }
}

// Theme Handling
const { isDark } = useTheme()
const overlayGradient = computed(() => {
    return isDark.value 
        ? 'linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4))' 
        : 'linear-gradient(rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.3))'
})
</script>

<template>
  <div class="login-container" :style="{ '--bg-image': `url(${currentBg})`, '--overlay-gradient': overlayGradient }">
    <div class="login-card fade-in">
      <!-- Logo & Title -->
      <div class="login-header">
        <div class="logo-wrapper">
          <img :src="dindinLogo" alt="Logo" class="logo-image" />
        </div>
        <h1 class="app-title">{{ envName }}</h1>
        <p class="app-subtitle">{{ t('appSubtitle') }}</p>
        <!-- Staging Badge Removed -->
      </div>

      <!-- Admin Login Form -->
      <div v-if="isAdminMode" class="admin-form fade-in">
          <div class="form-group">
              <label>{{ t('username') || 'Username' }}</label>
              <input v-model="adminUsername" type="text" class="form-input" placeholder="admin" @keyup.enter="handleAdminLogin">
          </div>
          <div class="form-group">
              <label>{{ t('password') || 'Password' }}</label>
              <input v-model="adminPassword" type="password" class="form-input" placeholder="••••••" @keyup.enter="handleAdminLogin">
          </div>
          
          <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
          
          <button @click="handleAdminLogin" class="btn-login btn-mfu" :disabled="isLoading">
              <span v-if="isLoading">...</span>
              <span v-else>{{ t('login') || 'Login' }}</span>
          </button>
          
          <div class="admin-login-wrapper">
            <a href="/login" class="btn-text-admin">← {{ t('backToSSO') || 'Back to SSO Login' }}</a>
        </div>
      </div>

      <!-- SSO Login Buttons (Default) -->
      <div v-else class="login-buttons">
        <a href="/api/auth/login/sso" class="btn-login btn-mfu">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          <span class="btn-text">Login</span>
        </a>
        
        <div class="admin-login-wrapper">
            <a href="/login?mode=admin" class="btn-text-admin">{{ t('adminLogin') || 'Admin Login' }}</a>
        </div>
      </div>

      <!-- Footer (Only on SSO view or stick to bottom) -->
      <div v-if="!isAdminMode" class="login-footer">
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
  /* Background handled by ::before to isolate blur */
  background-color: var(--color-bg-dark);
  position: relative;
  overflow: hidden;
}

/* Background Image & Effects (Blur + Dim) */
.login-container::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* Image */
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  /* Dim (Dark Overlay) or Lighten (White Overlay) based on theme */
  background-image: var(--overlay-gradient), var(--bg-image); 
  /* Blur (Reduced) */
  filter: blur(4px);
  /* Scale up slightly to hide blurred edges */
  transform: scale(1.05);
  z-index: 0;
  transition: background-image 0.5s ease-in-out;
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
  width: 120px; /* Adjusted size for image */
  height: 120px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Removed gradient background box since we have a PNG logo now, or keep it if desired? Usually clean logo is better. 
     User didn't specify, but often logos have their own background or transparency. I'll remove the colored box to let the logo shine. */
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
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

.login-buttons, .admin-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 4px;
}

.form-group label {
    font-size: 14px;
    color: var(--color-text);
    font-weight: 500;
}

.form-input {
    padding: 12px;
    border-radius: 10px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-input, rgba(255, 255, 255, 0.05));
    color: var(--color-text);
    outline: none;
    transition: border-color 0.2s;
}

.form-input:focus {
    border-color: var(--color-primary);
}

.error-msg {
    color: #ef4444;
    font-size: 13px;
    text-align: center;
    background: rgba(239, 68, 68, 0.1);
    padding: 8px;
    border-radius: 8px;
}

.btn-login {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 14px 24px;
  border-radius: 50px; /* Pill shape */
  font-weight: 600;
  font-size: 15px;
  text-decoration: none;
  cursor: pointer;
  border: none;
  transition: transform var(--transition-fast), opacity 0.2s, background-color 0.2s;
}

.btn-login:disabled {
    opacity: 0.7;
    cursor: wait;
}

.btn-login:hover:not(:disabled) {
  transform: translateY(-2px);
}

.btn-login .icon {
  width: 20px;
  height: 20px;
}

/* Solid Blue MFU Button (Requested Style) */
.btn-mfu {
  background: var(--color-accent); /* Solid Blue */
  color: white; /* White Text */
  border: none; /* No Border */
}

.btn-mfu:hover {
  background: var(--color-accent-hover);
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
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

.admin-login-wrapper {
    margin-top: 16px;
    text-align: center;
}

.btn-text-admin {
    font-size: 13px;
    color: var(--color-text-muted);
    text-decoration: none;
    transition: color 0.2s;
    cursor: pointer;
}

.btn-text-admin:hover {
    color: var(--color-primary);
    text-decoration: underline;
}
</style>
