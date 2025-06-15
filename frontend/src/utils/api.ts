import axios, { AxiosResponse, AxiosError } from 'axios'
import toast from 'react-hot-toast'

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('authToken')
      localStorage.removeItem('userData')
      window.location.href = '/login'
      toast.error('Session expired. Please login again.')
    } else if (error.response?.status === 403) {
      toast.error('You do not have permission to perform this action')
    } else if (error.response?.status && error.response.status >= 500) {
      toast.error('Server error. Please try again later.')
    }
    
    return Promise.reject(error)
  }
)

// API endpoints
export const authApi = {
  loginSaml: () => api.get('/api/auth/login/saml'),
  logout: () => api.post('/api/auth/logout'),
  refreshToken: (token: string) => api.post('/api/auth/refresh-token', { token }),
  guestLogin: (credentials: { username: string; password: string }) =>
    api.post('/api/auth/guest-login', credentials),
}

export const chatApi = {
  getChats: () => api.get('/api/chat/chats'),
  createChat: (data: { title?: string; modelId?: string }) => 
    api.post('/api/chat/chats', data),
  deleteChat: (chatId: string) => api.delete(`/api/chat/chats/${chatId}`),
  getChatHistory: (chatId: string) => api.get(`/api/chat/chats/${chatId}/history`),
  sendMessage: (chatId: string, message: string, modelId?: string) =>
    api.post(`/api/chat/chats/${chatId}/message`, { message, modelId }),
  editMessage: (chatId: string, messageId: string, content: string) =>
    api.put(`/api/chat/chats/${chatId}/messages/${messageId}`, { content }),
  deleteMessage: (chatId: string, messageId: string) =>
    api.delete(`/api/chat/chats/${chatId}/messages/${messageId}`),
  clearHistory: (chatId: string) => api.delete(`/api/chat/chats/${chatId}/history`),
  uploadFile: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/api/chat/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}

export const modelsApi = {
  getModels: () => api.get('/api/models'),
  createModel: (data: { 
    name: string; 
    modelType: 'personal' | 'department' | 'official';
    department?: string;
  }) => api.post('/api/models', data),
  updateModelCollections: (modelId: string, collections: string[]) =>
    api.put(`/api/models/${modelId}/collections`, { collections }),
  deleteModel: (modelId: string) => api.delete(`/api/models/${modelId}`),
  getModelDetails: (modelId: string) => api.get(`/api/models/${modelId}`),
}

export const trainingApi = {
  getCollections: () => api.get('/api/training/collections'),
  createCollection: (data: { name: string; description?: string }) =>
    api.post('/api/training/collections', data),
  deleteCollection: (collectionId: string) =>
    api.delete(`/api/training/collections/${collectionId}`),
  uploadDocument: (collectionId: string, file: File, metadata?: any) => {
    const formData = new FormData()
    formData.append('file', file)
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata))
    }
    return api.post(`/api/training/collections/${collectionId}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  getDocuments: (collectionId: string) =>
    api.get(`/api/training/collections/${collectionId}/documents`),
  deleteDocument: (collectionId: string, documentId: string) =>
    api.delete(`/api/training/collections/${collectionId}/documents/${documentId}`),
  getTrainingHistory: () => api.get('/api/training/history'),
}

export const adminApi = {
  getUsers: () => api.get('/api/admin/users'),
  updateUser: (userId: string, data: any) =>
    api.put(`/api/admin/users/${userId}`, data),
  deleteUser: (userId: string) => api.delete(`/api/admin/users/${userId}`),
  getUserUsageStats: (userId: string) =>
    api.get(`/api/admin/users/${userId}/usage`),
  getSystemSettings: () => api.get('/api/admin/settings'),
  updateSystemSettings: (settings: any) =>
    api.put('/api/admin/settings', settings),
}

export const statsApi = {
  getUserStats: () => api.get('/api/stats/user'),
  getSystemStats: () => api.get('/api/stats/system'),
  getDepartmentStats: () => api.get('/api/stats/department'),
}

export const departmentsApi = {
  getDepartments: () => api.get('/api/departments'),
  createDepartment: (data: { name: string; description?: string }) =>
    api.post('/api/departments', data),
  updateDepartment: (departmentId: string, data: any) =>
    api.put(`/api/departments/${departmentId}`, data),
  deleteDepartment: (departmentId: string) =>
    api.delete(`/api/departments/${departmentId}`),
}

// WebSocket connection with enhanced features
export class WebSocketManager {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private heartbeatInterval: NodeJS.Timeout | null = null
  private isReconnecting = false
  private chatId: string | null = null
  private onMessageCallback: ((data: any) => void) | null = null
  private onErrorCallback: ((error: any) => void) | null = null
  private onOpenCallback: (() => void) | null = null
  private onCloseCallback: (() => void) | null = null

  constructor() {
    this.setupHeartbeat()
  }

  connect(chatId?: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        this.chatId = chatId || null
        const token = localStorage.getItem('authToken')
        
        if (!token) {
          reject(new Error('No authentication token found'))
          return
        }

        const wsUrl = (import.meta.env.VITE_WS_URL || 'ws://localhost:5001').replace(/\/ws$/, '').replace(/\/$/, '')
        let url = `${wsUrl}/ws?token=${encodeURIComponent(token)}`
        
        if (chatId) {
          url += `&chat=${encodeURIComponent(chatId)}`
        }

        console.log('Connecting to WebSocket:', url.replace(token, '[TOKEN]'))
        
        this.ws = new WebSocket(url)
        
        this.ws.onopen = () => {
          console.log('WebSocket connected successfully')
          this.reconnectAttempts = 0
          this.isReconnecting = false
          this.startHeartbeat()
          
          if (this.onOpenCallback) {
            this.onOpenCallback()
          }
          
          resolve(this.ws!)
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            // Handle heartbeat pong
            if (data.type === 'pong') {
              return
            }
            
            if (this.onMessageCallback) {
              this.onMessageCallback(data)
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
            if (this.onErrorCallback) {
              this.onErrorCallback(error)
            }
          }
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          if (this.onErrorCallback) {
            this.onErrorCallback(error)
          }
        }

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason)
          this.stopHeartbeat()
          
          if (this.onCloseCallback) {
            this.onCloseCallback()
          }

          // Auto-reconnect if not intentionally closed
          if (event.code !== 1000 && !this.isReconnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnect()
          }
        }

        // Connection timeout
        setTimeout(() => {
          if (this.ws?.readyState === WebSocket.CONNECTING) {
            this.ws.close()
            reject(new Error('WebSocket connection timeout'))
          }
        }, 10000)

      } catch (error) {
        console.error('Error creating WebSocket connection:', error)
        reject(error)
      }
    })
  }

  private reconnect() {
    if (this.isReconnecting) return
    
    this.isReconnecting = true
    this.reconnectAttempts++
    
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    
    setTimeout(() => {
      this.connect(this.chatId || undefined)
        .catch((error) => {
          console.error('Reconnection failed:', error)
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached')
            if (this.onErrorCallback) {
              this.onErrorCallback(new Error('Connection lost and unable to reconnect'))
            }
          }
        })
    }, this.reconnectDelay * this.reconnectAttempts)
  }

  private setupHeartbeat() {
    // Send ping every 25 seconds (server expects pong within 30 seconds)
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' })
      }
    }, 25000)
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.setupHeartbeat()
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  send(data: any): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data))
        return true
      } catch (error) {
        console.error('Error sending WebSocket message:', error)
        return false
      }
    }
    console.warn('WebSocket is not open, cannot send message')
    return false
  }

  close() {
    this.isReconnecting = false
    this.stopHeartbeat()
    
    if (this.ws) {
      this.ws.close(1000, 'Client closing connection')
      this.ws = null
    }
  }

  onMessage(callback: (data: any) => void) {
    this.onMessageCallback = callback
  }

  onError(callback: (error: any) => void) {
    this.onErrorCallback = callback
  }

  onOpen(callback: () => void) {
    this.onOpenCallback = callback
  }

  onClose(callback: () => void) {
    this.onCloseCallback = callback
  }

  getChatId(): string | null {
    return this.chatId
  }

  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// Legacy function for backward compatibility
export const createWebSocketConnection = (chatId?: string): WebSocket => {
  const token = localStorage.getItem('authToken')
  const wsUrl = (import.meta.env.VITE_WS_URL || 'ws://localhost:5001').replace(/\/ws$/, '').replace(/\/$/, '')
  
  let url = `${wsUrl}/ws?token=${encodeURIComponent(token || '')}`
  if (chatId) {
    url += `&chat=${encodeURIComponent(chatId)}`
  }
  
  return new WebSocket(url)
}

// File upload helper
export const uploadFile = async (file: File, endpoint: string): Promise<any> => {
  const formData = new FormData()
  formData.append('file', file)
  
  try {
    const response = await api.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          )
          console.log(`Upload Progress: ${percentCompleted}%`)
        }
      },
    })
    return response.data
  } catch (error) {
    console.error('File upload error:', error)
    throw error
  }
}

export default api 