// A robust API utility for handling fetch requests with advanced features.

import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '../../entities/user/store';

/**
 * Creates a configured instance of Axios.
 * This instance includes the base API URL and an interceptor to automatically
 * add the JWT token to authorization headers.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000, // 15 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request Interceptor
 *
 * Intercepts each request to inject the JWT token from the auth store.
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 *
 * This interceptor simplifies the response data. On success (2xx), it returns
 * the `data` property of the response directly. On error, it rejects with
 * the error object, allowing `.catch()` or `try/catch` to handle it.
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  (error) => {
    // Reject with the error so the calling code can inspect it (e.g., error.response.status)
    return Promise.reject(error);
  }
);

/**
 * A wrapper around the configured axios instance.
 *
 * --- IMPORTANT ---
 * This is a breaking change in how API calls are handled.
 *
 * Instead of returning `{ success, data, error }`, these methods now
 * return a promise that resolves with the response data directly on success,
 * or rejects with an error on failure.
 *
 * Code should be updated from:
 * const { success, data, error } = await api.get(...);
 * if (success) { ... }
 *
 * To the standard promise pattern:
 * try {
 *   const data = await api.get(...);
 *   // work with data
 * } catch (error) {
 *   // handle error (e.g., check error.response.status)
 * }
 */
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    apiClient.get<T>(url, config),

  post: <T>(url:string, data?: any, config?: AxiosRequestConfig) =>
    apiClient.post<T>(url, data, config),

  put: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiClient.put<T>(url, data, config),

  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    apiClient.delete<T>(url, config),
};

// Exporting the raw instance in case advanced features (like cancelling requests) are needed.
export default apiClient;
