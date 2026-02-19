<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLanguage } from '@/composables/useSettings'
import axios from 'axios' // Make sure axios is available or use fetch

const router = useRouter()
const authStore = useAuthStore()
const { t } = useLanguage()

onMounted(async () => {
  const urlParams = new URLSearchParams(window.location.search)
  const code = urlParams.get('code')
  const token = urlParams.get('token') // Legacy/Fallback support
  
  if (code) {
    try {
      // Exchange code for token
      const redirectUri = window.location.origin + '/auth/callback'
      
      console.log('Exchanging code for token...')
      const response = await axios.post('/auth/sso/callback', {
        code,
        redirect_uri: redirectUri
      })

      const { token: authToken, user, sso_id_token } = response.data
      
      if (authToken && user) {
        authStore.setAuth(authToken, user)
        localStorage.setItem('auth_provider', 'sso')
        if (sso_id_token) {
            localStorage.setItem('sso_id_token', sso_id_token)
        }
        console.log('Auth successful:', user)
        router.push('/chat')
      } else {
        throw new Error('Invalid response from server')
      }

    } catch (e) {
      console.error('SSO Exchange Failed:', e)
      router.push('/login?error=auth_failed')
    }
  } else if (token) {
    // Legacy support (if needed, or for testing)
    const userDataB64 = urlParams.get('user_data')
    if (userDataB64) {
      try {
        const userData = JSON.parse(atob(userDataB64))
        authStore.setAuth(token, userData)
        localStorage.setItem('auth_provider', 'legacy')
        router.push('/chat')
      } catch (e) {
        router.push('/login?error=parse_failed')
      }
    }
  } else {
    // No code or token
    const error = urlParams.get('error')
    if (error) {
      router.push(`/login?error=${error}`)
    } else {
      router.push('/login')
    }
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
  min-height: 100svh; /* Safari Fix */
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
