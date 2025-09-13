import { StateCreator } from 'zustand';

/**
 * Store Registry - จัดการ store instances และ dependencies
 */
export interface StoreMetadata {
  name: string;
  dependencies?: string[];
  version: string;
  description: string;
}

export class StoreRegistry {
  private stores = new Map<string, any>();
  private metadata = new Map<string, StoreMetadata>();
  private initialized = new Set<string>();

  /**
   * ลงทะเบียน store
   */
  register<T>(name: string, store: T, metadata: StoreMetadata): void {
    this.stores.set(name, store);
    this.metadata.set(name, metadata);
    console.log(`📦 Registered store: ${name} v${metadata.version}`);
  }

  /**
   * ดึง store instance
   */
  getStore<T>(name: string): T | undefined {
    return this.stores.get(name);
  }

  /**
   * ตรวจสอบว่า store มี dependencies ครบหรือไม่
   */
  validateDependencies(name: string): boolean {
    const meta = this.metadata.get(name);
    if (!meta?.dependencies) return true;

    return meta.dependencies.every(dep => this.stores.has(dep));
  }

  /**
   * Initialize store พร้อม dependency checking
   */
  initialize(name: string): void {
    if (this.initialized.has(name)) return;

    const meta = this.metadata.get(name);
    if (!meta) {
      throw new Error(`Store ${name} not registered`);
    }

    // ตรวจสอบ dependencies
    if (!this.validateDependencies(name)) {
      const missingDeps = meta.dependencies?.filter(dep => !this.stores.has(dep));
      throw new Error(`Store ${name} missing dependencies: ${missingDeps?.join(', ')}`);
    }

    // Initialize dependencies first
    meta.dependencies?.forEach(dep => this.initialize(dep));

    this.initialized.add(name);
    console.log(`✅ Initialized store: ${name}`);
  }

  /**
   * ดู store statistics
   */
  getStats() {
    return {
      totalStores: this.stores.size,
      initializedStores: this.initialized.size,
      stores: Array.from(this.metadata.entries()).map(([name, meta]) => ({
        name,
        version: meta.version,
        dependencies: meta.dependencies || [],
        initialized: this.initialized.has(name)
      }))
    };
  }

  /**
   * Clear all stores (for testing/cleanup)
   */
  clear(): void {
    this.stores.clear();
    this.metadata.clear();
    this.initialized.clear();
    console.log('🗑️ Cleared all stores');
  }
}

// Singleton instance
export const storeRegistry = new StoreRegistry();