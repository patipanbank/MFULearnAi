import React, { useEffect, useState, useRef } from 'react';

interface PerformanceMetrics {
  renderCount: number;
  renderTime: number;
  memoryUsage: number;
  lastRenderTime: number;
  slowRenders: number;
  averageRenderTime: number;
}

interface PerformanceMonitorProps {
  componentName: string;
  threshold?: number; // milliseconds for slow render warning
  enabled?: boolean;
  children: React.ReactNode;
}

const usePerformanceMonitor = (componentName: string, threshold = 16) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderCount: 0,
    renderTime: 0,
    memoryUsage: 0,
    lastRenderTime: 0,
    slowRenders: 0,
    averageRenderTime: 0,
  });

  const renderStartRef = useRef<number>(0);
  const renderTimesRef = useRef<number[]>([]);

  useEffect(() => {
    renderStartRef.current = performance.now();
  });

  useEffect(() => {
    const renderEnd = performance.now();
    const renderTime = renderEnd - renderStartRef.current;

    // Keep last 100 render times for average calculation
    renderTimesRef.current.push(renderTime);
    if (renderTimesRef.current.length > 100) {
      renderTimesRef.current.shift();
    }

    const averageRenderTime = renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length;

    setMetrics(prev => ({
      renderCount: prev.renderCount + 1,
      renderTime: renderTime,
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      lastRenderTime: renderEnd,
      slowRenders: renderTime > threshold ? prev.slowRenders + 1 : prev.slowRenders,
      averageRenderTime,
    }));

    // Log slow renders in development
    if (process.env.NODE_ENV === 'development' && renderTime > threshold) {
      console.warn(`🐌 Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
    }
  });

  return metrics;
};

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  componentName,
  threshold = 16,
  enabled = process.env.NODE_ENV === 'development',
  children,
}) => {
  const metrics = usePerformanceMonitor(componentName, threshold);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div style={{ position: 'relative' }}>
      {children}

      {/* Performance overlay in development */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'fixed',
            top: 10,
            right: 10,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 9999,
            maxWidth: '300px',
          }}
          onClick={(e) => e.currentTarget.style.display = 'none'}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            📊 {componentName}
          </div>
          <div>Renders: {metrics.renderCount}</div>
          <div>Last: {metrics.renderTime.toFixed(2)}ms</div>
          <div>Avg: {metrics.averageRenderTime.toFixed(2)}ms</div>
          <div>Slow: {metrics.slowRenders}</div>
          {metrics.memoryUsage > 0 && (
            <div>Memory: {(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB</div>
          )}
          <div style={{ marginTop: '4px', fontSize: '10px', opacity: 0.7 }}>
            Click to hide
          </div>
        </div>
      )}
    </div>
  );
};

// Performance decorator for class components
export const withPerformanceMonitor = <P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) => {
  const WrappedComponent = React.forwardRef<any, P>((props, ref) => (
    <PerformanceMonitor componentName={componentName || Component.name}>
      <Component {...props} ref={ref} />
    </PerformanceMonitor>
  ));

  WrappedComponent.displayName = `withPerformanceMonitor(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// Hook for manual performance tracking
export const usePerformanceTracker = (name: string) => {
  const markStart = (label: string) => {
    performance.mark(`${name}-${label}-start`);
  };

  const markEnd = (label: string) => {
    performance.mark(`${name}-${label}-end`);
    performance.measure(`${name}-${label}`, `${name}-${label}-start`, `${name}-${label}-end`);

    const entries = performance.getEntriesByName(`${name}-${label}`);
    const duration = entries[entries.length - 1]?.duration;

    if (process.env.NODE_ENV === 'development' && duration) {
      console.log(`⏱️ ${name} ${label}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  };

  const measure = (label: string, fn: () => void) => {
    markStart(label);
    fn();
    return markEnd(label);
  };

  const measureAsync = async (label: string, fn: () => Promise<void>) => {
    markStart(label);
    await fn();
    return markEnd(label);
  };

  return { markStart, markEnd, measure, measureAsync };
};

// Memory usage monitor
export const useMemoryMonitor = (interval = 5000) => {
  const [memoryInfo, setMemoryInfo] = useState<{
    used: number;
    total: number;
    limit: number;
  } | null>(null);

  useEffect(() => {
    if (!(performance as any).memory) return;

    const updateMemoryInfo = () => {
      const memory = (performance as any).memory;
      setMemoryInfo({
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
      });
    };

    updateMemoryInfo();
    const intervalId = setInterval(updateMemoryInfo, interval);

    return () => clearInterval(intervalId);
  }, [interval]);

  return memoryInfo;
};

export default PerformanceMonitor;