import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
})

// Request interceptor - add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('auth_token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => Promise.reject(error)
)

// Response interceptor - handle auth errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config
        const status = error.response?.status

        // Refresh token only on 401 (unauthenticated), not on 403 (permission denied)
        if (status === 401 && !originalRequest?._retry) {
            originalRequest._retry = true

            try {
                // Attempt Refresh
                // distinct axios instance to avoid infinite loop if refresh fails
                const token = localStorage.getItem('auth_token')
                if (!token) throw new Error('No token to refresh')

                const { data } = await axios.post(`/auth/refresh`, {}, {
                    baseURL: api.defaults.baseURL,
                    headers: { Authorization: `Bearer ${token}` }
                })

                if (data.token) {
                    // Update Local Storage
                    localStorage.setItem('auth_token', data.token)

                    // Update Store (if accessible, or relies on localStorage reactivity/reload)
                    // Ideally we import store, but circular dependency risk. 
                    // Let's just update headers and retry.

                    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
                    originalRequest.headers['Authorization'] = `Bearer ${data.token}`

                    return api(originalRequest)
                }
            } catch (refreshError) {
                console.error('Session expired, refresh failed:', refreshError)

                const refreshStatus = refreshError?.response?.status
                // Force logout only when refresh is explicitly unauthorized
                if (refreshStatus === 401 || refreshStatus === 403) {
                    localStorage.removeItem('auth_token')
                    localStorage.removeItem('user_info')
                    window.location.href = '/login'
                }

                return Promise.reject(refreshError)
            }
        }

        // If retry already failed with 401, clear session
        if (status === 401 && originalRequest?._retry) {
            localStorage.removeItem('auth_token')
            localStorage.removeItem('user_info')
            window.location.href = '/login'
        }

        return Promise.reject(error)
    }
)

export default api
