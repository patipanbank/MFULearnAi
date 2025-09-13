/**
 * API Client - Type-safe HTTP client with error handling
 */

import type { ApiResponse, ApiListResponse, CommonQuery } from '../types/api.types';
import { ApiError } from '../types/api.types';

export interface RequestConfig extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private defaultTimeout: number;
  private interceptors: {
    request: Array<(config: RequestConfig) => RequestConfig | Promise<RequestConfig>>;
    response: Array<(response: Response) => Response | Promise<Response>>;
  };

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
    this.defaultTimeout = 30000; // 30 seconds
    this.interceptors = {
      request: [],
      response: []
    };

    // Add auth token interceptor
    this.addRequestInterceptor((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${token}`
        };
      }
      return config;
    });

    // Add response error interceptor
    this.addResponseInterceptor(async (response) => {
      if (!response.ok && response.status === 401) {
        // Token expired, redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      return response;
    });
  }

  addRequestInterceptor(interceptor: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>): void {
    this.interceptors.request.push(interceptor);
  }

  addResponseInterceptor(interceptor: (response: Response) => Response | Promise<Response>): void {
    this.interceptors.response.push(interceptor);
  }

  private async applyRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
    let finalConfig = config;
    for (const interceptor of this.interceptors.request) {
      finalConfig = await interceptor(finalConfig);
    }
    return finalConfig;
  }

  private async applyResponseInterceptors(response: Response): Promise<Response> {
    let finalResponse = response;
    for (const interceptor of this.interceptors.response) {
      finalResponse = await interceptor(finalResponse);
    }
    return finalResponse;
  }

  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const timeout = config.timeout || this.defaultTimeout;
    const retries = config.retries || 0;
    const retryDelay = config.retryDelay || 1000;

    // Apply request interceptors
    const finalConfig = await this.applyRequestInterceptors({
      ...config,
      headers: {
        ...this.defaultHeaders,
        ...config.headers
      }
    });

    const makeRequest = async (attempt: number = 0): Promise<ApiResponse<T>> => {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...finalConfig,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Apply response interceptors
        const finalResponse = await this.applyResponseInterceptors(response);

        const data = await finalResponse.json();

        if (!finalResponse.ok) {
          throw new ApiError(data, finalResponse.status);
        }

        return data;
      } catch (error) {
        // Retry logic
        if (attempt < retries && this.shouldRetry(error)) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
          return makeRequest(attempt + 1);
        }

        if (error instanceof ApiError) {
          throw error;
        }

        // Network or other errors
        throw new ApiError({
          success: false,
          error: error instanceof Error ? error.message : 'Network error',
          code: 'NETWORK_ERROR'
        });
      }
    };

    return makeRequest();
  }

  private shouldRetry(error: any): boolean {
    if (error instanceof ApiError) {
      // Don't retry client errors (4xx)
      return error.statusCode >= 500;
    }
    
    // Retry network errors
    return error.name === 'AbortError' || error.message.includes('Failed to fetch');
  }

  // HTTP Methods
  async get<T>(endpoint: string, query?: CommonQuery, config?: RequestConfig): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (query) {
      const searchParams = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => searchParams.append(key, String(v)));
          } else {
            searchParams.append(key, String(value));
          }
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    return this.request<T>(url, { ...config, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async patch<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  // Specialized methods for list responses
  async getList<T>(endpoint: string, query?: CommonQuery, config?: RequestConfig): Promise<ApiListResponse<T>> {
    let url = endpoint;
    if (query) {
      const searchParams = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => searchParams.append(key, String(v)));
          } else {
            searchParams.append(key, String(value));
          }
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    return this.request<T[]>(endpoint, { ...config, method: 'GET' }) as Promise<ApiListResponse<T>>;
  }

  // Upload files
  async upload<T>(endpoint: string, formData: FormData, config?: RequestConfig): Promise<ApiResponse<T>> {
    const uploadConfig: RequestConfig = {
      ...config,
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type, let browser set it with boundary
        ...Object.fromEntries(
          Object.entries(config?.headers || {}).filter(([key]) => key.toLowerCase() !== 'content-type')
        )
      }
    };

    return this.request<T>(endpoint, uploadConfig);
  }

  // WebSocket connection helper
  createWebSocket(endpoint: string): WebSocket {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = localStorage.getItem('token');
    
    const wsUrl = `${protocol}//${host}${endpoint}${token ? `?token=${token}` : ''}`;
    return new WebSocket(wsUrl);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}

// Create default instance
export const apiClient = new ApiClient();

// Export for custom instances
export default ApiClient;