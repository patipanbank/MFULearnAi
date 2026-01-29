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
  const code = urlParams.get('code')
  const token = urlParams.get('token')
  const userDataB64 = urlParams.get('user_data')

  if (code) {
    // Handle MFU SSO Code Exchange
    try {
      // We need to exchange this code for a token via our backend
      // Using fetch instead of axios to avoid potential setup issues here, or stick to what's used in project
      // Looking at imports, axios isn't imported. I'll use fetch.
      const response = await fetch('/api/auth/mfu/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      })

      if (!response.ok) {
        throw new Error('Token exchange failed')
      }

      const data = await response.json()
      
      authStore.setAuth(data.token, data.user)
      localStorage.setItem('auth_provider', 'mfu')
      
      console.log('MFU SSO Auth successful:', data.user)
      router.push('/chat')
    } catch (e) {
      console.error('MFU SSO Error:', e)
      router.push('/login?error=mfu_auth_failed')
    }
  } else if (token && userDataB64) {
    // Handle Google/Existing OAuth Callback
    try {
      // Decode base64 user data
      const userDataStr = atob(userDataB64)
      const userData = JSON.parse(userDataStr)
      const provider = urlParams.get('provider') || 'sso' // Default to sso if missing
      
      // Store in Pinia and localStorage
      authStore.setAuth(token, userData)
      localStorage.setItem('auth_provider', provider)
      
      console.log('Auth successful:', userData)
      router.push('/chat')
    } catch (e) {
      console.error('Failed to parse auth data:', e)
      router.push('/login?error=parse_failed')
    }
  } else {
    // Check for error
    const error = urlParams.get('error')
    if (error) {
      console.error('Auth error:', error)
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
