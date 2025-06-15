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

// WebSocket connection
export const createWebSocketConnection = (chatId?: string): WebSocket => {
  const token = localStorage.getItem('authToken')
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5001'
  
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