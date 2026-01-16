<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const token = urlParams.get('token')
  const userStr = urlParams.get('user')

  if (token && userStr) {
    try {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('user_info', userStr)
      console.log('Auth successful', JSON.parse(userStr))
      router.push('/chat')
    } catch (e) {
      console.error('Failed to parse user info', e)
      router.push('/login')
    }
  } else {
    // Check if error
    const error = urlParams.get('error')
    if (error) {
       alert('Login Failed: ' + error)
    }
    router.push('/login')
  }
})
</script>

<template>
  <div class="min-vh-100 d-flex flex-row align-items-center justify-content-center">
    <div class="spinner-border text-primary" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
    <span class="ms-2">Authenticating...</span>
  </div>
</template>
