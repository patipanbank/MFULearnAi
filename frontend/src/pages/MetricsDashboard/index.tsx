/**
 * Metrics Dashboard
 * Comprehensive monitoring dashboard for system performance and business metrics
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FiActivity, FiUsers, FiMessageSquare, FiServer, FiDatabase,
  FiWifi, FiAlertTriangle, FiTrendingUp, FiClock, FiMonitor
} from 'react-icons/fi';
import { api } from '../../shared/lib/api';

interface MetricsData {
  performance: {
    requestCount: number;
    responseTime: {
      min: number;
      max: number;
      avg: number;
      p95: number;
      p99: number;
    };
    errorCount: number;
    errorRate: number;
    activeConnections: number;
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
    };
    cpuUsage: number;
    cacheHitRate: number;
  };
  business: {
    activeUsers: number;
    newUsersToday: number;
    totalChats: number;
    newChatsToday: number;
    messagesPerChat: number;
    agentUsage: Record<string, number>;
    toolUsage: Record<string, number>;
    documentsProcessed: number;
    searchQueries: number;
  };
  health: {
    uptime: number;
    dependencies: {
      mongodb: boolean;
      redis: boolean;
      chroma: boolean;
      minio: boolean;
      aws: boolean;
    };
    servicesStatus: Record<string, 'healthy' | 'degraded' | 'down'>;
    alerts: Array<{
      level: 'info' | 'warning' | 'error' | 'critical';
      message: string;
      timestamp: string;
      service: string;
    }>;
  };
  timestamp: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
  trend?: {
    value: number;
    isUp: boolean;
  };
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon, color, trend }) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
  };

  return (
    <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-3 rounded-lg ${colorClasses[color]} text-white`}>
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted">{title}</h3>
            <p className="text-2xl font-bold text-primary">{value}</p>
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
        </div>
        {trend && (
          <div className={`flex items-center space-x-1 ${trend.isUp ? 'text-green-600' : 'text-red-600'}`}>
            <span className="text-sm font-medium">{trend.isUp ? '+' : ''}{trend.value}%</span>
            <FiTrendingUp className={`h-4 w-4 ${trend.isUp ? '' : 'rotate-180'}`} />
          </div>
        )}
      </div>
    </div>
  );
};

interface HealthIndicatorProps {
  service: string;
  status: boolean | 'healthy' | 'degraded' | 'down';
}

const HealthIndicator: React.FC<HealthIndicatorProps> = ({ service, status }) => {
  const getStatusColor = () => {
    if (typeof status === 'boolean') {
      return status ? 'bg-green-500' : 'bg-red-500';
    }

    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'down': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    if (typeof status === 'boolean') {
      return status ? 'Online' : 'Offline';
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
      <span className="text-sm font-medium text-primary">{service}</span>
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
        <span className="text-xs text-muted">{getStatusText()}</span>
      </div>
    </div>
  );
};

interface AlertItemProps {
  alert: MetricsData['health']['alerts'][0];
}

const AlertItem: React.FC<AlertItemProps> = ({ alert }) => {
  const getAlertColor = () => {
    switch (alert.level) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`p-3 rounded-lg border ${getAlertColor()}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <FiAlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">{alert.level}</span>
            <span className="text-xs">{alert.service}</span>
          </div>
          <p className="text-sm mt-1">{alert.message}</p>
        </div>
        <span className="text-xs whitespace-nowrap">
          {new Date(alert.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

const MetricsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds

  const fetchMetrics = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get<MetricsData>('/metrics');
      setMetrics(response);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setError('Failed to load metrics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchMetrics, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchMetrics]);

  const formatBytes = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <FiAlertTriangle className="h-5 w-5 text-red-600" />
          <span className="text-red-800 font-medium">Error</span>
        </div>
        <p className="text-red-700 mt-1">{error}</p>
        <button
          onClick={fetchMetrics}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">System Metrics Dashboard</h1>
          <p className="text-muted">
            Last updated: {new Date(metrics.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-muted">Auto-refresh</label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
          </div>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-3 py-1 border border-border rounded-lg text-sm"
            disabled={!autoRefresh}
          >
            <option value={10}>10s</option>
            <option value={30}>30s</option>
            <option value={60}>1m</option>
            <option value={300}>5m</option>
          </select>
          <button
            onClick={fetchMetrics}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Requests"
          value={metrics.performance.requestCount.toLocaleString()}
          icon={<FiActivity className="h-5 w-5" />}
          color="blue"
        />

        <MetricCard
          title="Avg Response Time"
          value={`${metrics.performance.responseTime.avg.toFixed(0)}ms`}
          subtitle={`P95: ${metrics.performance.responseTime.p95.toFixed(0)}ms`}
          icon={<FiClock className="h-5 w-5" />}
          color="green"
        />

        <MetricCard
          title="Error Rate"
          value={`${metrics.performance.errorRate.toFixed(2)}%`}
          subtitle={`${metrics.performance.errorCount} errors`}
          icon={<FiAlertTriangle className="h-5 w-5" />}
          color={metrics.performance.errorRate > 5 ? "red" : "green"}
        />

        <MetricCard
          title="Memory Usage"
          value={formatBytes(metrics.performance.memoryUsage.heapUsed)}
          subtitle={`Total: ${formatBytes(metrics.performance.memoryUsage.heapTotal)}`}
          icon={<FiMonitor className="h-5 w-5" />}
          color={metrics.performance.memoryUsage.heapUsed / metrics.performance.memoryUsage.heapTotal > 0.8 ? "yellow" : "green"}
        />
      </div>

      {/* Business Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Active Users"
          value={metrics.business.activeUsers.toLocaleString()}
          icon={<FiUsers className="h-5 w-5" />}
          color="purple"
        />

        <MetricCard
          title="Chats Today"
          value={metrics.business.newChatsToday.toLocaleString()}
          subtitle={`Total: ${metrics.business.totalChats.toLocaleString()}`}
          icon={<FiMessageSquare className="h-5 w-5" />}
          color="indigo"
        />

        <MetricCard
          title="WebSocket Connections"
          value={metrics.performance.activeConnections.toLocaleString()}
          icon={<FiWifi className="h-5 w-5" />}
          color="blue"
        />

        <MetricCard
          title="Cache Hit Rate"
          value={`${metrics.performance.cacheHitRate.toFixed(1)}%`}
          icon={<FiDatabase className="h-5 w-5" />}
          color={metrics.performance.cacheHitRate > 80 ? "green" : "yellow"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Health */}
        <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
          <div className="flex items-center space-x-2 mb-4">
            <FiServer className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-primary">System Health</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
              <span className="text-sm font-medium text-primary">Uptime</span>
              <span className="text-sm text-muted">{formatUptime(metrics.health.uptime)}</span>
            </div>

            {Object.entries(metrics.health.dependencies).map(([service, status]) => (
              <HealthIndicator
                key={service}
                service={service.toUpperCase()}
                status={status}
              />
            ))}

            {Object.entries(metrics.health.servicesStatus).map(([service, status]) => (
              <HealthIndicator
                key={service}
                service={service}
                status={status}
              />
            ))}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
          <div className="flex items-center space-x-2 mb-4">
            <FiAlertTriangle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-primary">Recent Alerts</h2>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {metrics.health.alerts.length > 0 ? (
              metrics.health.alerts.slice(0, 10).map((alert, index) => (
                <AlertItem key={index} alert={alert} />
              ))
            ) : (
              <p className="text-muted text-center py-4">No recent alerts</p>
            )}
          </div>
        </div>
      </div>

      {/* Agent and Tool Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold text-primary mb-4">Agent Usage</h2>
          <div className="space-y-3">
            {Object.entries(metrics.business.agentUsage).map(([agent, count]) => (
              <div key={agent} className="flex items-center justify-between">
                <span className="text-sm text-primary">{agent}</span>
                <span className="text-sm font-medium text-accent">{count.toLocaleString()}</span>
              </div>
            ))}
            {Object.keys(metrics.business.agentUsage).length === 0 && (
              <p className="text-muted text-center py-4">No agent usage data</p>
            )}
          </div>
        </div>

        <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold text-primary mb-4">Tool Usage</h2>
          <div className="space-y-3">
            {Object.entries(metrics.business.toolUsage).map(([tool, count]) => (
              <div key={tool} className="flex items-center justify-between">
                <span className="text-sm text-primary">{tool}</span>
                <span className="text-sm font-medium text-accent">{count.toLocaleString()}</span>
              </div>
            ))}
            {Object.keys(metrics.business.toolUsage).length === 0 && (
              <p className="text-muted text-center py-4">No tool usage data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsDashboard;