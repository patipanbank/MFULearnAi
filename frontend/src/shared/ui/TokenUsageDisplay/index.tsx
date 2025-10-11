import React, { useState, useEffect } from 'react';
import { FiActivity, FiCalendar, FiDatabase, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';
import { api } from '../../lib/api';

interface TokenUsage {
  userId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  chatCount: number;
  dailyUsage: {
    date: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  lastUsed: string;
  createdAt: string;
  updatedAt: string;
}

interface UserQuota {
  tokenQuota?: number;
  dailyTokenLimit?: number;
}

interface TokenUsageInfo {
  user: UserQuota | null;
  usage: TokenUsage | null;
  remainingQuota?: number;
  remainingDaily?: number;
}

interface TokenUsageDisplayProps {
  className?: string;
}

const TokenUsageDisplay: React.FC<TokenUsageDisplayProps> = ({ className = '' }) => {
  const [usageInfo, setUsageInfo] = useState<TokenUsageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsageInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await api.get<TokenUsageInfo>('/usage/me');
      setUsageInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching usage info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageInfo();
  }, []);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const getPercentage = (used: number, total: number) => {
    return total > 0 ? Math.round((used / total) * 100) : 0;
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
        <div className="flex items-center justify-center">
          <FiRefreshCw className="animate-spin mr-2" />
          <span className="text-gray-600 dark:text-gray-300">Loading usage information...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
        <div className="flex items-center text-red-600 dark:text-red-400">
          <FiAlertTriangle className="mr-2" />
          <span>Error: {error}</span>
        </div>
        <button
          onClick={fetchUsageInfo}
          className="mt-2 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!usageInfo?.usage) {
    return (
      <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
        <div className="text-center text-gray-600 dark:text-gray-300">
          <FiDatabase className="mx-auto mb-2 text-2xl" />
          <p>No usage data available</p>
        </div>
      </div>
    );
  }

  const { user, usage, remainingQuota, remainingDaily } = usageInfo;
  const today = new Date().toISOString().split('T')[0];
  const isToday = usage.dailyUsage.date === today;

  return (
    <div className={`p-6 bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <FiActivity className="mr-2" />
          Token Usage
        </h3>
        <button
          onClick={fetchUsageInfo}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          title="Refresh"
        >
          <FiRefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Total Usage */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Total Tokens Used
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {formatNumber(usage.totalTokens)}
              {user?.tokenQuota && ` / ${formatNumber(user.tokenQuota)}`}
            </span>
          </div>
          {user?.tokenQuota && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getProgressBarColor(getPercentage(usage.totalTokens, user.tokenQuota))}`}
                style={{ width: `${Math.min(getPercentage(usage.totalTokens, user.tokenQuota), 100)}%` }}
              ></div>
            </div>
          )}
          {remainingQuota !== undefined && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {remainingQuota > 0 ? `${formatNumber(remainingQuota)} tokens remaining` : 'Quota exceeded'}
            </p>
          )}
        </div>

        {/* Daily Usage */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
              <FiCalendar className="mr-1 w-3 h-3" />
              Daily Usage
              {!isToday && (
                <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                  (Last: {usage.dailyUsage.date})
                </span>
              )}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {formatNumber(isToday ? usage.dailyUsage.totalTokens : 0)}
              {user?.dailyTokenLimit && ` / ${formatNumber(user.dailyTokenLimit)}`}
            </span>
          </div>
          {user?.dailyTokenLimit && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getProgressBarColor(getPercentage(isToday ? usage.dailyUsage.totalTokens : 0, user.dailyTokenLimit))}`}
                style={{ width: `${Math.min(getPercentage(isToday ? usage.dailyUsage.totalTokens : 0, user.dailyTokenLimit), 100)}%` }}
              ></div>
            </div>
          )}
          {remainingDaily !== undefined && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {remainingDaily > 0 ? `${formatNumber(remainingDaily)} tokens remaining today` : 'Daily limit exceeded'}
            </p>
          )}
        </div>

        {/* Usage Breakdown */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatNumber(usage.inputTokens)}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Input Tokens</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatNumber(usage.outputTokens)}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Output Tokens</p>
          </div>
        </div>

        {/* Chat Count */}
        <div className="text-center pt-2">
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            {formatNumber(usage.chatCount)} Chats
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last used: {new Date(usage.lastUsed).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TokenUsageDisplay;