import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import router from '../router'

export interface User {
  id?: string
  username: string
  name?: string
  email: string
  role: 'Student' | 'Staff' | 'Admin' | 'SuperAdmin'
  avatar?: string
  token?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const isLoading = ref(false)

  // Initialize axios header if token exists
  if (token.value) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
  }

  const isAuthenticated = computed(() => !!token.value)

  function setUser(userData: any, newToken: string) {
    token.value = newToken
    user.value = {
      username: userData.username,
      name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.username,
      email: userData.email,
      role: userData.role || (userData.groups?.includes('admin') ? 'Admin' : 'Student'), // Simple mapping fallback
      avatar: `https://ui-avatars.com/api/?name=${userData.username}`
    }
    
    // Save to local storage
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(user.value))
    
    // Set axios header
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
  }

  // Restore user from local storage
  function initialize() {
    const storedUser = localStorage.getItem('user')
    if (storedUser && token.value) {
      try {
        user.value = JSON.parse(storedUser)
      } catch (e) {
        logout()
      }
    }
  }

  async function loginAdmin(username: string, password: string) {
    isLoading.value = true
    try {
      const response = await axios.post('/api/auth/admin/login', { username, password })
      setUser(response.data.user, response.data.token)
      return true
    } catch (error) {
      console.error('Login failed', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete axios.defaults.headers.common['Authorization']
    router.push('/login')
  }

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    setUser,
    initialize,
    loginAdmin,
    logout
  }
})
