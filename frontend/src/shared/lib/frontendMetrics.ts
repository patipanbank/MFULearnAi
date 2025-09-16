/**
 * Frontend Metrics Service
 * Collects and reports client-side performance metrics
 */

export interface FrontendMetrics {
  // Page performance
  pageLoadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;

  // React performance
  componentRenderTime: Map<string, number[]>;
  slowRenders: Array<{
    component: string;
    duration: number;
    timestamp: Date;
  }>;

  // User interaction
  clickEvents: number;
  scrollEvents: number;
  userSessions: number;
  timeOnPage: number;

  // Chat specific metrics
  messagesPerSession: number;
  averageResponseTime: number;
  chatLoadTime: number;
  websocketReconnects: number;

  // Error tracking
  jsErrors: Array<{
    message: string;
    stack: string;
    timestamp: Date;
    url: string;
    userAgent: string;
  }>;

  // Network metrics
  apiCallDuration: Map<string, number[]>;
  failedRequests: number;
  networkSpeed: 'slow' | 'medium' | 'fast';

  // Resource usage
  memoryUsage: number;
  bundleSize: number;
  cacheHitRate: number;
}

interface MetricsConfig {
  enableAutoReporting: boolean;
  reportingInterval: number;
  maxErrorHistory: number;
  slowRenderThreshold: number;
  apiEndpoint?: string;
}

class FrontendMetricsService {
  private metrics: FrontendMetrics;
  private config: MetricsConfig;
  private reportingTimer: number | null = null;
  private performanceObserver: PerformanceObserver | null = null;
  private sessionStartTime: number;

  constructor(config: Partial<MetricsConfig> = {}) {
    this.config = {
      enableAutoReporting: config.enableAutoReporting ?? true,
      reportingInterval: config.reportingInterval ?? 60000, // 1 minute
      maxErrorHistory: config.maxErrorHistory ?? 50,
      slowRenderThreshold: config.slowRenderThreshold ?? 16, // 16ms
      apiEndpoint: config.apiEndpoint,
    };

    this.sessionStartTime = Date.now();
    this.initializeMetrics();
    this.setupPerformanceObserver();
    this.setupErrorHandling();
    this.setupUserInteractionTracking();

    if (this.config.enableAutoReporting) {
      this.startAutoReporting();
    }
  }

  private initializeMetrics(): void {
    this.metrics = {
      pageLoadTime: 0,
      domContentLoaded: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      cumulativeLayoutShift: 0,
      firstInputDelay: 0,
      componentRenderTime: new Map(),
      slowRenders: [],
      clickEvents: 0,
      scrollEvents: 0,
      userSessions: 1,
      timeOnPage: 0,
      messagesPerSession: 0,
      averageResponseTime: 0,
      chatLoadTime: 0,
      websocketReconnects: 0,
      jsErrors: [],
      apiCallDuration: new Map(),
      failedRequests: 0,
      networkSpeed: 'medium',
      memoryUsage: 0,
      bundleSize: 0,
      cacheHitRate: 0,
    };

    // Capture initial page load metrics
    this.capturePageLoadMetrics();
  }

  private setupPerformanceObserver(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();

        entries.forEach((entry) => {
          switch (entry.entryType) {
            case 'paint':
              if (entry.name === 'first-contentful-paint') {
                this.metrics.firstContentfulPaint = entry.startTime;
              }
              break;

            case 'largest-contentful-paint':
              this.metrics.largestContentfulPaint = entry.startTime;
              break;

            case 'layout-shift':
              if (!(entry as any).hadRecentInput) {
                this.metrics.cumulativeLayoutShift += (entry as any).value;
              }
              break;

            case 'first-input':
              this.metrics.firstInputDelay = (entry as any).processingStart - entry.startTime;
              break;

            case 'navigation':
              const navEntry = entry as PerformanceNavigationTiming;
              this.metrics.pageLoadTime = navEntry.loadEventEnd - navEntry.navigationStart;
              this.metrics.domContentLoaded = navEntry.domContentLoadedEventEnd - navEntry.navigationStart;
              break;
          }
        });
      });

      this.performanceObserver.observe({
        entryTypes: ['paint', 'largest-contentful-paint', 'layout-shift', 'first-input', 'navigation']
      });
    } catch (error) {
      console.warn('Performance Observer not supported:', error);
    }
  }

  private capturePageLoadMetrics(): void {
    // Wait for page to fully load
    if (document.readyState === 'complete') {
      this.processPageLoadMetrics();
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => this.processPageLoadMetrics(), 0);
      });
    }
  }

  private processPageLoadMetrics(): void {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      this.metrics.pageLoadTime = navigation.loadEventEnd - navigation.navigationStart;
      this.metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.navigationStart;
    }

    // Detect network speed
    this.detectNetworkSpeed();

    // Estimate memory usage
    this.updateMemoryUsage();
  }

  private detectNetworkSpeed(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      const effectiveType = connection.effectiveType;

      if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        this.metrics.networkSpeed = 'slow';
      } else if (effectiveType === '3g') {
        this.metrics.networkSpeed = 'medium';
      } else {
        this.metrics.networkSpeed = 'fast';
      }
    }
  }

  private updateMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize;
    }
  }

  private setupErrorHandling(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.recordError({
        message: event.message,
        stack: event.error?.stack || '',
        timestamp: new Date(),
        url: event.filename || window.location.href,
        userAgent: navigator.userAgent,
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack || '',
        timestamp: new Date(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    });
  }

  private setupUserInteractionTracking(): void {
    // Track clicks
    document.addEventListener('click', () => {
      this.metrics.clickEvents++;
    });

    // Track scrolls (throttled)
    let scrollTimer: number | null = null;
    document.addEventListener('scroll', () => {
      if (scrollTimer) return;

      scrollTimer = window.setTimeout(() => {
        this.metrics.scrollEvents++;
        scrollTimer = null;
      }, 100);
    });

    // Track time on page
    setInterval(() => {
      this.metrics.timeOnPage = Date.now() - this.sessionStartTime;
    }, 1000);

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.reportMetrics();
      }
    });

    // Track before page unload
    window.addEventListener('beforeunload', () => {
      this.reportMetrics();
    });
  }

  private startAutoReporting(): void {
    this.reportingTimer = window.setInterval(() => {
      this.reportMetrics();
    }, this.config.reportingInterval);
  }

  // Public methods for recording custom metrics
  recordComponentRender(componentName: string, duration: number): void {
    const renders = this.metrics.componentRenderTime.get(componentName) || [];
    renders.push(duration);

    // Keep only last 100 renders per component
    if (renders.length > 100) {
      renders.shift();
    }

    this.metrics.componentRenderTime.set(componentName, renders);

    // Record slow renders
    if (duration > this.config.slowRenderThreshold) {
      this.metrics.slowRenders.push({
        component: componentName,
        duration,
        timestamp: new Date(),
      });

      // Keep only last 50 slow renders
      if (this.metrics.slowRenders.length > 50) {
        this.metrics.slowRenders.shift();
      }
    }
  }

  recordApiCall(endpoint: string, duration: number, success: boolean): void {
    const calls = this.metrics.apiCallDuration.get(endpoint) || [];
    calls.push(duration);

    // Keep only last 100 calls per endpoint
    if (calls.length > 100) {
      calls.shift();
    }

    this.metrics.apiCallDuration.set(endpoint, calls);

    if (!success) {
      this.metrics.failedRequests++;
    }
  }

  recordChatMetric(type: 'message' | 'response' | 'load' | 'reconnect', value?: number): void {
    switch (type) {
      case 'message':
        this.metrics.messagesPerSession++;
        break;
      case 'response':
        if (value) {
          // Calculate rolling average
          const current = this.metrics.averageResponseTime;
          const count = this.metrics.messagesPerSession;
          this.metrics.averageResponseTime = ((current * (count - 1)) + value) / count;
        }
        break;
      case 'load':
        if (value) {
          this.metrics.chatLoadTime = value;
        }
        break;
      case 'reconnect':
        this.metrics.websocketReconnects++;
        break;
    }
  }

  recordError(error: {
    message: string;
    stack: string;
    timestamp: Date;
    url: string;
    userAgent: string;
  }): void {
    this.metrics.jsErrors.push(error);

    // Keep only recent errors
    if (this.metrics.jsErrors.length > this.config.maxErrorHistory) {
      this.metrics.jsErrors.shift();
    }

    console.error('Frontend error recorded:', error);
  }

  // Get metrics summary
  getMetricsSummary() {
    this.updateMemoryUsage();

    return {
      ...this.metrics,
      // Calculated metrics
      averageComponentRenderTime: this.calculateAverageRenderTime(),
      slowRenderRate: this.calculateSlowRenderRate(),
      errorRate: this.calculateErrorRate(),
      averageApiResponseTime: this.calculateAverageApiResponseTime(),
      timestamp: new Date(),
      sessionDuration: Date.now() - this.sessionStartTime,
    };
  }

  private calculateAverageRenderTime(): number {
    let totalTime = 0;
    let totalRenders = 0;

    this.metrics.componentRenderTime.forEach((times) => {
      totalTime += times.reduce((sum, time) => sum + time, 0);
      totalRenders += times.length;
    });

    return totalRenders > 0 ? totalTime / totalRenders : 0;
  }

  private calculateSlowRenderRate(): number {
    const totalRenders = Array.from(this.metrics.componentRenderTime.values())
      .reduce((sum, times) => sum + times.length, 0);

    return totalRenders > 0 ? (this.metrics.slowRenders.length / totalRenders) * 100 : 0;
  }

  private calculateErrorRate(): number {
    const totalInteractions = this.metrics.clickEvents + this.metrics.scrollEvents + this.metrics.messagesPerSession;
    return totalInteractions > 0 ? (this.metrics.jsErrors.length / totalInteractions) * 100 : 0;
  }

  private calculateAverageApiResponseTime(): number {
    let totalTime = 0;
    let totalCalls = 0;

    this.metrics.apiCallDuration.forEach((times) => {
      totalTime += times.reduce((sum, time) => sum + time, 0);
      totalCalls += times.length;
    });

    return totalCalls > 0 ? totalTime / totalCalls : 0;
  }

  // Report metrics to backend
  async reportMetrics(): Promise<void> {
    if (!this.config.apiEndpoint) return;

    try {
      const metrics = this.getMetricsSummary();

      await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'frontend-metrics',
          metrics,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }),
      });

      console.log('📊 Frontend metrics reported successfully');
    } catch (error) {
      console.error('Failed to report frontend metrics:', error);
    }
  }

  // Web Vitals integration
  async measureWebVitals(): Promise<void> {
    try {
      // Dynamic import of web-vitals if available
      const { getCLS, getFID, getFCP, getLCP, getTTFB } = await import('web-vitals');

      getCLS((metric) => {
        this.metrics.cumulativeLayoutShift = metric.value;
      });

      getFID((metric) => {
        this.metrics.firstInputDelay = metric.value;
      });

      getFCP((metric) => {
        this.metrics.firstContentfulPaint = metric.value;
      });

      getLCP((metric) => {
        this.metrics.largestContentfulPaint = metric.value;
      });

      getTTFB((metric) => {
        // Time to First Byte - can be useful for API performance
        console.log('TTFB:', metric.value);
      });
    } catch (error) {
      console.warn('Web Vitals not available:', error);
    }
  }

  // Cleanup
  destroy(): void {
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    // Final metrics report
    this.reportMetrics();
  }
}

// Global instance
export const frontendMetrics = new FrontendMetricsService({
  enableAutoReporting: process.env.NODE_ENV === 'production',
  apiEndpoint: '/api/metrics/frontend',
});

// React Hook for component performance tracking (requires React import)
export const usePerformanceTracking = (componentName: string) => {
  // This would require React to be imported
  // const [renderStart] = React.useState(() => performance.now());

  // For now, we'll track render time differently
  const renderStart = performance.now();

  // Use setTimeout to capture render end time
  setTimeout(() => {
    const renderEnd = performance.now();
    const renderTime = renderEnd - renderStart;
    frontendMetrics.recordComponentRender(componentName, renderTime);
  }, 0);

  return {
    recordCustomMetric: (metricName: string, value: number) => {
      frontendMetrics.recordComponentRender(`${componentName}_${metricName}`, value);
    }
  };
};

export default frontendMetrics;