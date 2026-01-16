<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

onMounted(() => {
  const token = route.query.token as string
  const userDataStr = route.query.user_data as string

  if (token && userDataStr) {
    try {
      // Decode user data (base64)
      const userData = JSON.parse(atob(userDataStr))
      authStore.setUser(userData, token)
      router.push('/')
    } catch (e) {
      console.error('Failed to parse auth data', e)
      router.push('/login?error=auth_failed')
    }
  } else {
    router.push('/login?error=missing_token')
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="flex flex-col items-center gap-4">
      <div class="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-gray-600 font-medium">Authenticating...</p>
    </div>
  </div>
</template>
