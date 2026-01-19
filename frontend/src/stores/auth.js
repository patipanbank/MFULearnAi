import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../utils/api'

export const useAuthStore = defineStore('auth', () => {
    const user = ref(null)
    const token = ref(null)
    const isLoading = ref(false)

    const isAuthenticated = computed(() => !!token.value)
    const userRole = computed(() => user.value?.role || 'guest')
    // Alias for components expecting 'role'
    const role = computed(() => user.value?.role || 'guest')

    const userId = computed(() => user.value?._id || user.value?.userId)
    const department = computed(() => user.value?.department)

    const displayName = computed(() => {
        if (!user.value) return 'Guest'
        return user.value.firstName
            ? `${user.value.firstName} ${user.value.lastName || ''}`.trim()
            : user.value.username
    })

    // Initialize from localStorage
    function init() {
        const storedToken = localStorage.getItem('auth_token')
        const storedUser = localStorage.getItem('user_info')

        if (storedToken) {
            token.value = storedToken
        }
        if (storedUser) {
            try {
                user.value = JSON.parse(storedUser)
            } catch (e) {
                console.error('Failed to parse user info:', e)
            }
        }
    }

    // Set auth from callback
    function setAuth(newToken, userData) {
        token.value = newToken
        user.value = userData
        localStorage.setItem('auth_token', newToken)
        localStorage.setItem('user_info', JSON.stringify(userData))
    }

    // Clear auth (logout)
    function logout() {
        token.value = null
        user.value = null
        const authProvider = localStorage.getItem('auth_provider')
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_info')
        localStorage.removeItem('auth_provider')
        localStorage.removeItem('active_collection_id') // Clear chat persistence if any

        // Redirect to SSO Logout if applicable (SLO)
        // Redirect to SSO Logout if applicable (SLO)
        if (authProvider === 'sso') {
            window.location.href = `${api.defaults.baseURL}/auth/logout`
        } else if (authProvider === 'google') {
            // For Google, we just clear local data (which is done above)
            // and redirect to login. authenticating again will force new token.
            window.location.href = '/login'
        } else {
            // Local logout: just reload or redirect to login
            window.location.href = '/login'
        }
    }

    // Refresh user info from API
    async function refreshUser() {
        if (!token.value) return

        isLoading.value = true
        try {
            const response = await api.get('/auth/me')
            user.value = response.data.user
            localStorage.setItem('user_info', JSON.stringify(response.data.user))
        } catch (error) {
            console.error('Failed to refresh user:', error)
            if (error.response?.status === 401) {
                logout()
            }
        } finally {
            isLoading.value = false
        }
    }

    // Admin Login
    async function loginAdmin(username, password) {
        isLoading.value = true
        try {
            const response = await api.post('/auth/admin/login', { username, password })
            const { token, user } = response.data
            setAuth(token, user)
            return true
        } catch (error) {
            console.error('Login failed:', error)
            throw error
        } finally {
            isLoading.value = false
        }
    }

    return {
        user,
        token,
        isLoading,
        isAuthenticated,
        userRole, // Deprecated, use role
        role,
        userId,
        department,
        displayName,
        init,
        setAuth,
        logout,
        refreshUser,
        loginAdmin
    }
})
