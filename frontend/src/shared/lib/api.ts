// A robust API utility for handling fetch requests with advanced features.

import { useAuthStore } from '../../entities/user/store';

// Default options for fetch requests
const DEFAULT_TIMEOUT = 15000; // 15 seconds

// Interface for API responses
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  status: number;
  error?: string;
}

// Interface for request options, extending RequestInit
interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

// Internal function to handle fetch with timeout
async function fetchWithTimeout(
  resource: RequestInfo,
  options: RequestOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(resource, {
    ...options,
    signal: controller.signal
  });

  clearTimeout(id);
  return response;
}

// Main request function with retry logic
async function request<T>(
  url: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  let { retries = 1, retryDelay = 1000, headers = {}, ...restOptions } = options;
  const token = useAuthStore.getState().token;

  // Add Authorization header if token exists
  if (token) {
    headers = {
      ...headers,
      'Authorization': `Bearer ${token}`
    };
  }
  
  // Add default headers if not present
  headers = {
    'Content-Type': 'application/json',
    ...headers
  };
  
  const finalOptions: RequestOptions = {
    ...restOptions,
    headers,
  };

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetchWithTimeout(url, finalOptions);

      if (!response.ok) {
        // For client-side errors, don't retry
        if (response.status >= 400 && response.status < 500) {
          const errorData = await response.json().catch(() => ({ message: 'Invalid JSON response' }));
          return {
            success: false,
            data: null,
            status: response.status,
            error: errorData?.message || response.statusText
          };
        }
        // For server-side errors, retry
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data: T = await response.json();
      return { success: true, data, status: response.status };

    } catch (error) {
      // If it's the last retry, return the error
      if (i === retries - 1) {
        return {
          success: false,
          data: null,
          status: 0,
          error: error instanceof Error ? error.message : 'An unknown error occurred'
        };
      }
      // Wait before retrying
      await new Promise(res => setTimeout(res, retryDelay * (i + 1)));
    }
  }

  // This should not be reached, but is a fallback
  return {
    success: false,
    data: null,
    status: 0,
    error: 'Request failed after all retries'
  };
}

// Exported API methods
export const api = {
  get: <T>(url: string, options?: RequestOptions) => 
    request<T>(url, { ...options, method: 'GET' }),
  
  post: <T>(url: string, body: any, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'POST', body: JSON.stringify(body) }),
  
  put: <T>(url: string, body: any, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'PUT', body: JSON.stringify(body) }),

  delete: <T>(url: string, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'DELETE' }),
};
