// 🚀 Enterprise API Client for MFU Learn AI
// Provides type-safe, centralized API endpoint management

import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '../../entities/user/store';

// ================================
// 🏗️ API CONFIGURATION
// ================================

const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL || 'https://mfulearnai.mfu.ac.th/api/v1',
  timeout: 30000, // 30 seconds for better reliability
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
} as const;

// ================================
// 📋 API ENDPOINTS REGISTRY
// ================================

export const API_ENDPOINTS = {
  // 🔐 Authentication Endpoints
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
    saml: {
      login: '/auth/login/saml',
      logout: '/auth/logout/saml',
      callback: '/auth/saml/callback',
      metadata: '/auth/metadata',
    },
  },
  
  // 💬 Chat Endpoints
  chat: {
    list: '/chats',
    create: '/chats',
    byId: (id: string) => `/chats/${id}`,
    messages: (id: string) => `/chats/${id}/messages`,
    ask: (id: string) => `/chats/${id}/ask`,
    clearMemory: (id: string) => `/chats/${id}/clear-memory`,
    memoryStats: (id: string) => `/chats/${id}/memory/stats`,
  },
  
  // 🤖 Agent Endpoints
  agents: {
    list: '/agents',
    create: '/agents',
    byId: (id: string) => `/agents/${id}`,
    update: (id: string) => `/agents/${id}`,
    delete: (id: string) => `/agents/${id}`,
    execute: (id: string) => `/agents/${id}/execute`,
  },
  
  // 📚 Collection Endpoints
  collections: {
    list: '/collections',
    create: '/collections',
    byId: (id: string) => `/collections/${id}`,
    update: (id: string) => `/collections/${id}`,
    delete: (id: string) => `/collections/${id}`,
    documents: (id: string) => `/collections/${id}/documents`,
  },
  
  // 📤 Upload Endpoints
  upload: {
    file: '/upload',
  },
  
  // ⚙️ Admin Endpoints
  admin: {
    users: '/admins',
    create: '/admins/create',
    byId: (id: string) => `/admins/${id}`,
    systemPrompt: '/admins/system-prompt',
  },
  
  // 🏢 Department Endpoints
  departments: {
    list: '/departments',
    create: '/departments',
    byId: (id: string) => `/departments/${id}`,
    update: (id: string) => `/departments/${id}`,
    delete: (id: string) => `/departments/${id}`,
  },
  
  // 📊 Stats Endpoints
  stats: {
    overview: '/stats',
    chat: '/stats/chat',
    usage: '/stats/usage',
  },
  
  // 🔍 Embeddings Endpoints
  embeddings: {
    search: '/embeddings/search',
    create: '/embeddings',
  },
} as const;

// ================================
// 🔧 AXIOS INSTANCE CONFIGURATION
// ================================

const apiClient = axios.create(API_CONFIG);

// ================================
// 🔑 REQUEST INTERCEPTOR
// ================================

apiClient.interceptors.request.use(
  (config) => {
    // Add authentication token
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add request ID for debugging
    config.headers['X-Request-ID'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add user agent info
    config.headers['X-User-Agent'] = navigator.userAgent;
    
    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
        data: config.data,
        params: config.params,
      });
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request Interceptor Error:', error);
    return Promise.reject(error);
  }
);

// ================================
// 📥 RESPONSE INTERCEPTOR
// ================================

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log successful response in development
    if (import.meta.env.DEV) {
      console.log(`✅ API Response: ${response.status} ${response.config.url}`, response.data);
    }
    
    return response.data;
  },
  (error) => {
    // Enhanced error logging
    if (import.meta.env.DEV) {
      console.error('❌ API Error:', {
        status: error.response?.status,
        url: error.config?.url,
        method: error.config?.method,
        data: error.response?.data,
        message: error.message,
      });
    }
    
    // Handle specific error cases
    if (error.response?.status === 401) {
      // Token expired or invalid
      const authStore = useAuthStore.getState();
      authStore.logout();
      
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    // Handle rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      if (retryAfter) {
        console.warn(`🚦 Rate limited. Retry after ${retryAfter} seconds`);
      }
    }
    
    return Promise.reject(error);
  }
);

// ================================
// 🎯 TYPE-SAFE API CLIENT
// ================================

export const api = {
  // Generic HTTP methods
  get: <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.get(url, config),

  post: <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.post(url, data, config),

  put: <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.put(url, data, config),

  patch: <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.patch(url, data, config),

  delete: <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.delete(url, config),
} as const;

// ================================
// 🔐 AUTHENTICATION API
// ================================

export const authApi = {
  login: (credentials: { username: string; password: string }) =>
    api.post(API_ENDPOINTS.auth.login, credentials),
    
  refresh: (refreshToken: string) =>
    api.post(API_ENDPOINTS.auth.refresh, { refreshToken }),
    
  logout: () =>
    api.post(API_ENDPOINTS.auth.logout),
    
  me: () =>
    api.get(API_ENDPOINTS.auth.me),
    
  saml: {
    login: () => {
      // Redirect to SAML login (external redirect)
      window.location.href = `${API_CONFIG.baseURL}${API_ENDPOINTS.auth.saml.login}`;
    },
    
    logout: () => {
      // Redirect to SAML logout (external redirect)
      window.location.href = `${API_CONFIG.baseURL}${API_ENDPOINTS.auth.saml.logout}`;
    },
  },
} as const;

// ================================
// 💬 CHAT API
// ================================

export const chatApi = {
  list: () => api.get(API_ENDPOINTS.chat.list),
  
  create: (data: { name: string; agentId?: string }) =>
    api.post(API_ENDPOINTS.chat.create, data),
    
  getById: (id: string) => api.get(API_ENDPOINTS.chat.byId(id)),
  
  addMessage: (id: string, content: string) =>
    api.post(API_ENDPOINTS.chat.messages(id), { content }),
    
  ask: (id: string, params: {
    content: string;
    modelId?: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  }) => api.post(API_ENDPOINTS.chat.ask(id), params),
  
  clearMemory: (id: string) =>
    api.delete(API_ENDPOINTS.chat.clearMemory(id)),
    
  getMemoryStats: (id: string) =>
    api.get(API_ENDPOINTS.chat.memoryStats(id)),
} as const;

// ================================
// 📤 UPLOAD API
// ================================

export const uploadApi = {
  file: (file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return api.post(API_ENDPOINTS.upload.file, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },
} as const;

// ================================
// 🔧 UTILITY FUNCTIONS
// ================================

export const apiUtils = {
  // Get full URL for an endpoint
  getFullUrl: (endpoint: string) => `${API_CONFIG.baseURL}${endpoint}`,
  
  // Check if response is successful
  isSuccess: (status: number) => status >= 200 && status < 300,
  
  // Parse error message from response
  getErrorMessage: (error: any): string => {
    if (error.response?.data?.userMessage) {
      return error.response.data.userMessage;
    }
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  },
  
  // Format file size
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
} as const;

// Export the raw axios instance for advanced use cases
export default apiClient;
