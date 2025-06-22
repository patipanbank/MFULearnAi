// A robust API utility for handling fetch requests with advanced features.

import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import { useAuthStore } from '../../entities/user/store';
import { config } from '../../config/config';

// Define the structure of our API response
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  status: number;
  error?: string;
}

// Create a new axios instance with a custom config
const axiosInstance: AxiosInstance = axios.create({
  baseURL: config.apiUrl,
  timeout: 15000, // 15 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Injects the auth token into every request
axiosInstance.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log request details for debugging
    if (config.url) {
      console.log('API Request:', {
        url: config.url,
        baseURL: config.baseURL,
        fullUrl: config.baseURL ? `${config.baseURL}${config.url}` : config.url
      });
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handles global errors, like 401
axiosInstance.interceptors.response.use(
  (response) => {
    // Any status code that lie within the range of 2xx cause this function to trigger
    console.log('API Response:', {
      url: response.config.url,
      status: response.status,
      contentType: response.headers['content-type']
    });
    
    return response;
  },
  (error) => {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    console.error('API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      contentType: error.response?.headers?.['content-type'],
      data: error.response?.data,
      message: error.message
    });
    
    if (error.response?.status === 401) {
      // If we get a 401, logout the user
      useAuthStore.getState().logout();
    }
    
    return Promise.reject(error);
  }
);


// Helper function to wrap axios requests into our standard ApiResponse format
async function request<T>(
  axiosPromise: Promise<any>
): Promise<ApiResponse<T>> {
  try {
    const response = await axiosPromise;
    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      return {
        success: false,
        data: null,
        status: axiosError.response?.status || 0,
        error: axiosError.response?.data?.message || axiosError.message,
      };
    }
    // For non-axios errors
    return {
      success: false,
      data: null,
      status: 0,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
}


// Exported API methods using the new axios instance and wrapper
export const api = {
  get: <T>(url: string, params?: object) => 
    request<T>(axiosInstance.get<T>(url, { params })),
  
  post: <T>(url: string, data: any, options?: object) =>
    request<T>(axiosInstance.post<T>(url, data, options)),
  
  put: <T>(url: string, data: any, options?: object) =>
    request<T>(axiosInstance.put<T>(url, data, options)),

  delete: <T>(url:string, options?: object) =>
    request<T>(axiosInstance.delete<T>(url, options)),
};
