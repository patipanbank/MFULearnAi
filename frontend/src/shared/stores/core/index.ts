/**
 * Store Core - Export ทั้งหมดจาก core modules
 */

export * from './storeRegistry';
export * from './storeMiddleware';
export * from './storeActions';
export * from './storeSync';

// Re-export enhanced stores
export * from '../enhanced/chatStore.enhanced';

// Utility functions
export const createStoreWithDefaults = <T extends object>(
  config: any,
  name: string
) => {
  return config; // Can add default middleware here
};