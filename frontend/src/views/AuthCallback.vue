<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLanguage } from '@/composables/useSettings'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useLanguage()

onMounted(async () => {
  const urlParams = new URLSearchParams(window.location.search)
  const token = urlParams.get('token')
  const error = urlParams.get('error')

  if (error) {
    console.error('Auth error:', error)
    router.push(`/login?error=${error}`)
    return
  }

  if (token) {
    try {
      const provider = urlParams.get('provider') || 'sso'
      const idToken = urlParams.get('id_token')
      
      // 1. Store Token (Temporary without user data)
      // We manually set it here so api.js interceptor picks it up
      authStore.token = token
      localStorage.setItem('auth_token', token)
      
      if (idToken) {
        localStorage.setItem('id_token', idToken)
      }
      localStorage.setItem('auth_provider', provider)

      // 2. Fetch User Profile
      console.log('Fetching user profile...')
      await authStore.refreshUser()

      // 3. Verify Success
      if (authStore.user) {
        console.log('Auth successful:', authStore.user)
        router.push('/chat')
      } else {
         throw new Error('Failed to fetch user profile')
      }

    } catch (e) {
      console.error('Auth flow failed:', e)
      // Clean up
      authStore.logout() 
      router.push('/login?error=auth_flow_failed')
    }
  } else {
    router.push('/login')
  }
})
</script>

<template>
  <div class="callback-container">
    <div class="loader-card fade-in">
      <div class="spinner"></div>
      <p class="loader-text">{{ t('authenticating') }}</p>
      <p class="loader-subtext">{{ t('verifyCreds') }}</p>
    </div>
  </div>
</template>

<style scoped>
.callback-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-dark);
}

.loader-card {
  text-align: center;
  padding: 48px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 24px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loader-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 8px;
}

.loader-subtext {
  font-size: 14px;
  color: var(--color-text-muted);
}
</style>
