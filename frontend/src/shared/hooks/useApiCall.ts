/**
 * useApiCall Hook - Type-safe API calls with error handling and loading states
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ApiResponse, ApiListResponse, ApiError } from '../types/api.types';
import { apiClient } from '../lib/apiClient';

export interface UseApiCallOptions {
  immediate?: boolean;
  retries?: number;
  retryDelay?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: ApiError) => void;
}

export interface UseApiCallState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  lastUpdated: Date | null;
  requestId: string | null;
}

export interface UseApiCallActions {
  execute: (...args: any[]) => Promise<any>;
  reset: () => void;
  retry: () => Promise<any>;
}

export type UseApiCallReturn<T> = UseApiCallState<T> & UseApiCallActions;

export function useApiCall<T = any>(
  apiFunction: (...args: any[]) => Promise<ApiResponse<T>>,
  options: UseApiCallOptions = {}
): UseApiCallReturn<T> {
  const [state, setState] = useState<UseApiCallState<T>>({
    data: null,
    loading: false,
    error: null,
    lastUpdated: null,
    requestId: null
  });

  const lastArgsRef = useRef<any[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const execute = useCallback(async (...args: any[]) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    lastArgsRef.current = args;

    if (!isMountedRef.current) return;

    setState(prev => ({
      ...prev,
      loading: true,
      error: null
    }));

    try {
      const response = await apiFunction(...args);
      
      if (!isMountedRef.current) return response.data;

      setState(prev => ({
        ...prev,
        data: response.data || null,
        loading: false,
        error: null,
        lastUpdated: new Date(),
        requestId: response.meta?.requestId || null
      }));

      options.onSuccess?.(response.data);
      return response.data;
    } catch (error) {
      if (!isMountedRef.current) return;

      const apiError = error instanceof ApiError ? error : new ApiError({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'UNKNOWN_ERROR'
      });

      setState(prev => ({
        ...prev,
        loading: false,
        error: apiError,
        lastUpdated: new Date()
      }));

      options.onError?.(apiError);
      throw apiError;
    }
  }, [apiFunction, options]);

  const retry = useCallback(async () => {
    return execute(...lastArgsRef.current);
  }, [execute]);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setState({
      data: null,
      loading: false,
      error: null,
      lastUpdated: null,
      requestId: null
    });
  }, []);

  // Immediate execution
  useEffect(() => {
    if (options.immediate) {
      execute();
    }
  }, [execute, options.immediate]);

  return {
    ...state,
    execute,
    retry,
    reset
  };
}

// Specialized hooks for different response types
export function useApiList<T = any>(
  apiFunction: (...args: any[]) => Promise<ApiListResponse<T>>,
  options: UseApiCallOptions = {}
): UseApiCallReturn<T[]> & { meta: ApiListResponse<T>['meta'] | null } {
  const [meta, setMeta] = useState<ApiListResponse<T>['meta'] | null>(null);
  
  const result = useApiCall(apiFunction, {
    ...options,
    onSuccess: (response: ApiListResponse<T>) => {
      setMeta(response.meta);
      options.onSuccess?.(response);
    }
  });

  return {
    ...result,
    meta
  };
}

// Hook for mutations (POST, PUT, DELETE)
export function useApiMutation<TData = any, TVariables = any>(
  mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>,
  options: UseApiCallOptions = {}
) {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);

  const result = useApiCall(mutationFn, {
    ...options,
    onSuccess: (data) => {
      setIsSuccess(true);
      setIsError(false);
      options.onSuccess?.(data);
    },
    onError: (error) => {
      setIsError(true);
      setIsSuccess(false);
      options.onError?.(error);
    }
  });

  const mutate = useCallback(async (variables: TVariables) => {
    setIsSuccess(false);
    setIsError(false);
    return result.execute(variables);
  }, [result.execute]);

  const reset = useCallback(() => {
    setIsSuccess(false);
    setIsError(false);
    result.reset();
  }, [result.reset]);

  return {
    ...result,
    mutate,
    reset,
    isSuccess,
    isError
  };
}

// Hook for optimistic updates
export function useOptimisticUpdate<T>(
  initialData: T,
  updateFn: (data: T, variables: any) => T
) {
  const [optimisticData, setOptimisticData] = useState<T>(initialData);
  const [actualData, setActualData] = useState<T>(initialData);

  const applyOptimisticUpdate = useCallback((variables: any) => {
    const newData = updateFn(actualData, variables);
    setOptimisticData(newData);
  }, [actualData, updateFn]);

  const confirmUpdate = useCallback((newData: T) => {
    setActualData(newData);
    setOptimisticData(newData);
  }, []);

  const revertUpdate = useCallback(() => {
    setOptimisticData(actualData);
  }, [actualData]);

  return {
    data: optimisticData,
    applyOptimisticUpdate,
    confirmUpdate,
    revertUpdate
  };
}