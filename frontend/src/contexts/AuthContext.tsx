import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { jwtDecode } from 'jwt-decode'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '../utils/api'

export interface User {
  nameID: string
  username: string
  email?: string
  firstName?: string
  lastName?: string
  department?: string
  groups: string[]
  role?: 'Students' | 'Staffs' | 'Admin' | 'SuperAdmin'
}

interface JWTPayload {
  nameID: string
  username: string
  email?: string
  firstName?: string
  lastName?: string
  department?: string
  groups: string[]
  role?: string
  exp: number
  iat: number
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (token: string, userData?: User) => Promise<void>
  logout: (showMessage?: boolean) => Promise<void>
  refreshToken: () => Promise<boolean>
  isAuthenticated: () => boolean
  isAdmin: () => boolean
  isSuperAdmin: () => boolean
  hasRole: (role: string) => boolean
  hasPermission: (permission: string) => boolean
  checkTokenExpiry: () => boolean
  clearAuth: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // Storage keys
  const TOKEN_KEY = 'authToken'
  const USER_KEY = 'userData'
  const REFRESH_TOKEN_KEY = 'refreshToken'

  // Clear all authentication data
  const clearAuth = useCallback(() => {
    setUser(null)
    setToken(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    sessionStorage.clear()
  }, [])

  // Check if token is expired
  const checkTokenExpiry = useCallback((token?: string): boolean => {
    try {
      const tokenToCheck = token || localStorage.getItem(TOKEN_KEY)
      if (!tokenToCheck) return false

      const decoded: JWTPayload = jwtDecode(tokenToCheck)
      const currentTime = Date.now() / 1000
      const timeUntilExpiry = decoded.exp - currentTime
      
      // Token is expired if less than 0 seconds remaining
      return timeUntilExpiry <= 0
    } catch (error) {
      console.error('Error checking token expiry:', error)
      return true // Treat invalid tokens as expired
    }
  }, [])

  // Get token expiry time
  const getTokenExpiryTime = useCallback((token: string): number | null => {
    try {
      const decoded: JWTPayload = jwtDecode(token)
      return decoded.exp
    } catch (error) {
      return null
    }
  }, [])

  // Refresh token function
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const currentToken = localStorage.getItem(TOKEN_KEY)
      if (!currentToken) return false

      // Check if we need to refresh (within 5 minutes of expiry)
      const decoded: JWTPayload = jwtDecode(currentToken)
      const currentTime = Date.now() / 1000
      const timeUntilExpiry = decoded.exp - currentTime
      
      if (timeUntilExpiry > 300) { // More than 5 minutes left
        return true
      }

      // Attempt to refresh token
      const response = await authApi.refreshToken(currentToken)
      
      if (response.data.success && response.data.token) {
        const newToken = response.data.token
        const userData = response.data.user
        
        setToken(newToken)
        setUser(userData)
        localStorage.setItem(TOKEN_KEY, newToken)
        localStorage.setItem(USER_KEY, JSON.stringify(userData))
        
        return true
      }
      
      return false
    } catch (error) {
      console.error('Token refresh failed:', error)
      return false
    }
  }, [])

  // Auto-refresh token setup
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout

    if (token && user) {
      // Set up automatic token refresh
      refreshInterval = setInterval(async () => {
        const success = await refreshToken()
        if (!success) {
          await logout(false)
          navigate('/login')
          toast.error('Session expired. Please log in again.')
        }
      }, 4 * 60 * 1000) // Check every 4 minutes
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [token, user, refreshToken, navigate])

  // Initialize authentication state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem(TOKEN_KEY)
        const storedUser = localStorage.getItem(USER_KEY)

        if (storedToken && storedUser) {
          // Check if token is expired
          if (checkTokenExpiry(storedToken)) {
            // Try to refresh token
            const refreshSuccess = await refreshToken()
            if (!refreshSuccess) {
              clearAuth()
              toast.error('Session expired. Please log in again.')
            }
          } else {
            // Token is valid, restore session
            try {
              const userData: User = JSON.parse(storedUser)
              setToken(storedToken)
              setUser(userData)
            } catch (error) {
              console.error('Error parsing stored user data:', error)
              clearAuth()
            }
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        clearAuth()
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()
  }, [checkTokenExpiry, refreshToken, clearAuth])

  // Extract user info from token
  const extractUserFromToken = useCallback((tokenPayload: JWTPayload): User => {
    const groups = Array.isArray(tokenPayload.groups) ? tokenPayload.groups : [tokenPayload.groups].filter(Boolean)
    
    return {
      nameID: tokenPayload.nameID,
      username: tokenPayload.username,
      email: tokenPayload.email,
      firstName: tokenPayload.firstName,
      lastName: tokenPayload.lastName,
      department: tokenPayload.department,
      groups,
      role: tokenPayload.role as any || 
            (groups.includes('SuperAdmin') ? 'SuperAdmin' :
             groups.includes('Admin') ? 'Admin' :
             groups.includes('Staffs') ? 'Staffs' : 'Students')
    }
  }, [])

  // Login function
  const login = useCallback(async (newToken: string, userData?: User): Promise<void> => {
    try {
      // Validate token
      const decoded: JWTPayload = jwtDecode(newToken)
      
      // Check if token is expired
      if (checkTokenExpiry(newToken)) {
        throw new Error('Token is expired')
      }

      // Use provided userData or extract from token
      const userInfo: User = userData || extractUserFromToken(decoded)

      setToken(newToken)
      setUser(userInfo)
      
      // Store in localStorage
      localStorage.setItem(TOKEN_KEY, newToken)
      localStorage.setItem(USER_KEY, JSON.stringify(userInfo))
      
      // Set session expiry warning
      const expiryTime = getTokenExpiryTime(newToken)
      if (expiryTime) {
        const warningTime = (expiryTime - Date.now() / 1000 - 300) * 1000 // 5 minutes before expiry
        if (warningTime > 0) {
          setTimeout(() => {
            toast('Your session will expire in 5 minutes. Please save your work.', {
              duration: 10000,
            })
          }, warningTime)
        }
      }
      
      toast.success(`Welcome back, ${userInfo.firstName || userInfo.username}!`)
    } catch (error) {
      console.error('Login error:', error)
      clearAuth()
      throw new Error('Invalid authentication token')
    }
  }, [checkTokenExpiry, extractUserFromToken, getTokenExpiryTime, clearAuth])

  // Logout function
  const logout = useCallback(async (showMessage: boolean = true): Promise<void> => {
    try {
      // Call server logout if token exists
      if (token) {
        try {
          await authApi.logout()
        } catch (error) {
          console.error('Server logout error:', error)
          // Continue with client-side logout even if server call fails
        }
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearAuth()
      navigate('/login')
      if (showMessage) {
        toast.success('Logged out successfully')
      }
    }
  }, [token, clearAuth, navigate])

  // Authentication check functions
  const isAuthenticated = useCallback((): boolean => {
    return !!(user && token && !checkTokenExpiry())
  }, [user, token, checkTokenExpiry])

  const isAdmin = useCallback((): boolean => {
    return user?.groups?.includes('Admin') || user?.groups?.includes('SuperAdmin') || user?.role === 'Admin' || user?.role === 'SuperAdmin' || false
  }, [user])

  const isSuperAdmin = useCallback((): boolean => {
    return user?.groups?.includes('SuperAdmin') || user?.role === 'SuperAdmin' || false
  }, [user])

  const hasRole = useCallback((role: string): boolean => {
    return user?.groups?.includes(role) || user?.role === role || false
  }, [user])

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false
    
    // SuperAdmin has all permissions
    if (isSuperAdmin()) return true
    
    // Define permission mappings
    const permissions = {
      'admin': ['Admin', 'SuperAdmin'],
      'manage_users': ['SuperAdmin'],
      'manage_models': ['Admin', 'SuperAdmin', 'Staffs'],
      'view_statistics': ['Admin', 'SuperAdmin'],
      'manage_departments': ['Admin', 'SuperAdmin'],
      'upload_documents': ['Students', 'Staffs', 'Admin', 'SuperAdmin'],
      'chat': ['Students', 'Staffs', 'Admin', 'SuperAdmin']
    }
    
    const allowedRoles = permissions[permission as keyof typeof permissions]
    if (!allowedRoles) return false
    
    return allowedRoles.some(role => hasRole(role))
  }, [user, isSuperAdmin, hasRole])

  // Handle token expiry
  useEffect(() => {
    const handleTokenExpiry = () => {
      logout(false)
      toast.error('Your session has expired. Please log in again.')
    }

    // Check token expiry on page focus
    const handleVisibilityChange = () => {
      if (!document.hidden && token && checkTokenExpiry()) {
        handleTokenExpiry()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [token, checkTokenExpiry, logout])

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      if (!isAuthenticated() && window.location.pathname !== '/login') {
        navigate('/login')
      }
    }

    window.addEventListener('popstate', handlePopState)
    
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isAuthenticated, navigate])

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    logout,
    refreshToken,
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    hasRole,
    hasPermission,
    checkTokenExpiry,
    clearAuth
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext 