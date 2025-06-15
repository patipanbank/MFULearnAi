import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { jwtDecode } from 'jwt-decode'
import toast from 'react-hot-toast'

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

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (token: string, userData?: User) => void
  logout: () => void
  isAdmin: () => boolean
  isSuperAdmin: () => boolean
  hasRole: (role: string) => boolean
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

  // Check for stored token on app load
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken')
    const storedUser = localStorage.getItem('userData')

    if (storedToken && storedUser) {
      try {
        // Verify token is not expired
        const decoded: any = jwtDecode(storedToken)
        const currentTime = Date.now() / 1000

        if (decoded.exp > currentTime) {
          setToken(storedToken)
          setUser(JSON.parse(storedUser))
        } else {
          // Token expired, clear storage
          localStorage.removeItem('authToken')
          localStorage.removeItem('userData')
          toast.error('Session expired. Please login again.')
        }
      } catch (error) {
        console.error('Error parsing stored auth data:', error)
        localStorage.removeItem('authToken')
        localStorage.removeItem('userData')
      }
    }
    
    setLoading(false)
  }, [])

  const login = (newToken: string, userData?: User) => {
    try {
      const decoded: any = jwtDecode(newToken)
      
      // Use provided userData or extract from token
      const userInfo: User = userData || {
        nameID: decoded.nameID,
        username: decoded.username,
        email: decoded.email,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        department: decoded.department,
        groups: decoded.groups || [],
        role: decoded.groups?.includes('SuperAdmin') ? 'SuperAdmin' :
              decoded.groups?.includes('Admin') ? 'Admin' :
              decoded.groups?.includes('Staffs') ? 'Staffs' : 'Students'
      }

      setToken(newToken)
      setUser(userInfo)
      
      // Store in localStorage
      localStorage.setItem('authToken', newToken)
      localStorage.setItem('userData', JSON.stringify(userInfo))
      
      toast.success(`Welcome back, ${userInfo.firstName || userInfo.username}!`)
    } catch (error) {
      console.error('Error decoding token:', error)
      toast.error('Invalid authentication token')
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('authToken')
    localStorage.removeItem('userData')
    toast.success('Logged out successfully')
  }

  const isAdmin = (): boolean => {
    return user?.groups?.includes('Admin') || user?.groups?.includes('SuperAdmin') || false
  }

  const isSuperAdmin = (): boolean => {
    return user?.groups?.includes('SuperAdmin') || false
  }

  const hasRole = (role: string): boolean => {
    return user?.groups?.includes(role) || false
  }

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    logout,
    isAdmin,
    isSuperAdmin,
    hasRole
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext 