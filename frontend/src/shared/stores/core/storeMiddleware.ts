import type { StateCreator } from 'zustand';

/**
 * Logging Middleware - ติดตาม state changes
 */
export const withLogging = <T extends object>(
  config: StateCreator<T, [], [], T>,
  name: string
): StateCreator<T, [], [], T> => (set, get, api) =>
  config(
    (args) => {
      const prevState = get();
      set(args);
      const nextState = get();
      
      // Log only in development
      if (import.meta.env.DEV) {
        console.group(`🔄 Store Update: ${name}`);
        console.log('Previous:', prevState);
        console.log('Next:', nextState);
        console.groupEnd();
      }
    },
    get,
    api
  );

/**
 * Error Boundary Middleware - จัดการ errors ใน store
 */
export const withErrorBoundary = <T extends object>(
  config: StateCreator<T, [], [], T>,
  name: string
): StateCreator<T, [], [], T> => (set, get, api) => {
  try {
    return config(set, get, api);
  } catch (error) {
    console.error(`❌ Error in store ${name}:`, error);
    
    // Reset to safe state
    return {} as T;
  }
};

/**
 * Performance Middleware - วัด performance ของ actions
 */
export const withPerformance = <T extends object>(
  config: StateCreator<T, [], [], T>,
  name: string
): StateCreator<T, [], [], T> => (set, get, api) => {
  const wrappedSet = (args: any) => {
    const start = performance.now();
    set(args);
    const end = performance.now();
    
    if (end - start > 10) { // Log only slow updates
      console.warn(`⚠️ Slow store update in ${name}: ${(end - start).toFixed(2)}ms`);
    }
  };

  return config(wrappedSet, get, api);
};

/**
 * Validation Middleware - validate state changes
 */
export const withValidation = <T extends object>(
  config: StateCreator<T, [], [], T>,
  validator: (state: T) => boolean | string,
  name: string
): StateCreator<T, [], [], T> => (set, get, api) =>
  config(
    (args) => {
      set(args);
      const newState = get();
      const validation = validator(newState);
      
      if (validation !== true) {
        console.error(`❌ Validation failed in ${name}:`, validation);
        // Could implement rollback here
      }
    },
    get,
    api
  );

/**
 * Compose multiple middleware
 */
export const composeMiddleware = <T extends object>(
  config: StateCreator<T, [], [], T>,
  middlewares: Array<(config: StateCreator<T, [], [], T>, name: string) => StateCreator<T, [], [], T>>,
  name: string
): StateCreator<T, [], [], T> => {
  return middlewares.reduce(
    (acc, middleware) => middleware(acc, name),
    config
  );
};

/**
 * Default middleware stack for development
 */
export const withDevMiddleware = <T extends object>(
  config: StateCreator<T, [], [], T>,
  name: string
): StateCreator<T, [], [], T> => {
  if (!import.meta.env.DEV) {
    return config;
  }

  return composeMiddleware(config, [
    withErrorBoundary,
    withPerformance,
    withLogging
  ], name);
};