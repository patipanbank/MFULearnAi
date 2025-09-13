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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const createStoreWithDefaults = <_T extends object>(
  config: any,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _name: string
) => {
  return config; // Can add default middleware here
};