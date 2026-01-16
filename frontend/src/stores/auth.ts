import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface User {
  id: string
  email: string
  name: string
  role: 'Student' | 'Staff' | 'Admin' | 'SuperAdmin'
  avatar?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => !!user.value)
  const isLoading = ref(false)

  // Mock login for now - will be replaced with actual API calls
  function loginMock(role: User['role'] = 'Student') {
    isLoading.value = true
    setTimeout(() => {
      user.value = {
        id: '123',
        email: 'user@mae.mfu.ac.th',
        name: 'Test User',
        role: role,
        avatar: 'https://ui-avatars.com/api/?name=Test+User'
      }
      isLoading.value = false
    }, 1000)
  }

  function logout() {
    user.value = null
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    loginMock,
    logout
  }
})
