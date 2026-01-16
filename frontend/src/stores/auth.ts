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
    
    // Handle inconsistent field names from backend (SAML vs Google)
    const firstName = userData.firstName || userData.first_name || ''
    const lastName = userData.lastName || userData.last_name || ''
    
    // Map backend roles/groups to frontend roles
    let role: User['role'] = 'Student'
    const backendRole = userData.role || (userData.groups && userData.groups[0])
    
    if (backendRole) {
      if (backendRole === 'SuperAdmin' || userData.groups?.includes('SuperAdmin')) role = 'SuperAdmin'
      else if (backendRole === 'Admin' || userData.groups?.includes('Admin')) role = 'Admin'
      else if (backendRole === 'Staffs' || backendRole === 'Staff' || userData.groups?.includes('Staffs')) role = 'Staff'
    }

    user.value = {
      username: userData.username,
      name: `${firstName} ${lastName}`.trim() || userData.username,
      email: userData.email,
      role,
      avatar: `https://ui-avatars.com/api/?name=${userData.username}&background=random`
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
