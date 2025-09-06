/**
 * Store Synchronization - ซิงค์ data ระหว่าง stores และ external sources
 */

export interface SyncConfig {
  key: string;
  interval?: number; // milliseconds
  immediate?: boolean;
  onError?: (error: Error) => void;
}

export interface SyncAdapter<T> {
  load(): Promise<T>;
  save(data: T): Promise<void>;
  subscribe?(callback: (data: T) => void): () => void;
}

export class StoreSync<T> {
  private adapter: SyncAdapter<T>;
  private config: SyncConfig;
  private syncInterval?: NodeJS.Timeout;
  private unsubscribe?: () => void;
  private lastSync = 0;

  constructor(adapter: SyncAdapter<T>, config: SyncConfig) {
    this.adapter = adapter;
    this.config = config;
  }

  /**
   * เริ่ม sync process
   */
  async start(updateStore: (data: T) => void): Promise<void> {
    console.log(`🔄 Starting sync for ${this.config.key}`);

    // Initial load
    if (this.config.immediate !== false) {
      await this.syncFromSource(updateStore);
    }

    // Set up periodic sync
    if (this.config.interval) {
      this.syncInterval = setInterval(
        () => this.syncFromSource(updateStore),
        this.config.interval
      );
    }

    // Set up reactive sync if supported
    if (this.adapter.subscribe) {
      this.unsubscribe = this.adapter.subscribe((data) => {
        console.log(`📡 Received sync update for ${this.config.key}`);
        updateStore(data);
        this.lastSync = Date.now();
      });
    }
  }

  /**
   * หยุด sync
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    console.log(`⏹️ Stopped sync for ${this.config.key}`);
  }

  /**
   * Force sync now
   */
  async syncNow(updateStore: (data: T) => void): Promise<void> {
    await this.syncFromSource(updateStore);
  }

  /**
   * Save to external source
   */
  async saveToSource(data: T): Promise<void> {
    try {
      await this.adapter.save(data);
      console.log(`💾 Saved ${this.config.key} to external source`);
    } catch (error) {
      console.error(`❌ Failed to save ${this.config.key}:`, error);
      this.config.onError?.(error as Error);
    }
  }

  private async syncFromSource(updateStore: (data: T) => void): Promise<void> {
    try {
      const data = await this.adapter.load();
      updateStore(data);
      this.lastSync = Date.now();
      console.log(`✅ Synced ${this.config.key} from external source`);
    } catch (error) {
      console.error(`❌ Failed to sync ${this.config.key}:`, error);
      this.config.onError?.(error as Error);
    }
  }

  /**
   * Get sync statistics
   */
  getStats() {
    return {
      key: this.config.key,
      lastSync: new Date(this.lastSync),
      isActive: Boolean(this.syncInterval || this.unsubscribe),
      interval: this.config.interval
    };
  }
}

// LocalStorage Adapter
export class LocalStorageAdapter<T> implements SyncAdapter<T> {
  constructor(private key: string, private defaultValue: T) {}

  async load(): Promise<T> {
    try {
      const data = localStorage.getItem(this.key);
      return data ? JSON.parse(data) : this.defaultValue;
    } catch (error) {
      console.error(`Failed to load from localStorage (${this.key}):`, error);
      return this.defaultValue;
    }
  }

  async save(data: T): Promise<void> {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to save to localStorage (${this.key}):`, error);
      throw error;
    }
  }
}

// API Adapter
export class ApiAdapter<T> implements SyncAdapter<T> {
  constructor(
    private endpoint: string,
    private defaultValue: T,
    private options: RequestInit = {}
  ) {}

  async load(): Promise<T> {
    try {
      const response = await fetch(this.endpoint, {
        ...this.options,
        method: 'GET'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Failed to load from API (${this.endpoint}):`, error);
      return this.defaultValue;
    }
  }

  async save(data: T): Promise<void> {
    try {
      const response = await fetch(this.endpoint, {
        ...this.options,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.options.headers
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to save to API (${this.endpoint}):`, error);
      throw error;
    }
  }
}