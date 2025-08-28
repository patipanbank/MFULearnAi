import React, { useState, useEffect } from 'react';
import { FiActivity, FiRefreshCw, FiAlertTriangle, FiDatabase } from 'react-icons/fi';

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

interface CompactTokenUsageProps {
  className?: string;
}

const CompactTokenUsage: React.FC<CompactTokenUsageProps> = ({ className = '' }) => {
  const [usageInfo, setUsageInfo] = useState<TokenUsageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsageInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/usage/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Usage API Error:', response.status, errorText);
        throw new Error(`Failed to fetch usage information: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Usage API Response:', data);
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
    // Refresh every 30 seconds
    const interval = setInterval(fetchUsageInfo, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
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
      <div className={`flex items-center px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm ${className}`}>
        <FiRefreshCw className="animate-spin w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm ${className}`}>
        <FiAlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />
        <span className="ml-2 text-sm text-red-600 dark:text-red-400">Error loading usage</span>
      </div>
    );
  }

  if (!usageInfo) {
    return (
      <div className={`flex items-center px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm ${className}`}>
        <FiDatabase className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">No usage data</span>
      </div>
    );
  }

  const { user, usage } = usageInfo;
  const today = new Date().toISOString().split('T')[0];
  const isToday = usage?.dailyUsage?.date === today;
  const dailyUsed = isToday ? (usage?.dailyUsage?.totalTokens || 0) : 0;

  return (
    <div className={`flex items-center px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${className}`}>
      <FiActivity className="w-4 h-4 text-blue-500 dark:text-blue-400" />
      
      <div className="ml-2 flex items-center space-x-3">
        {/* Daily Usage Only */}
        {user?.dailyTokenLimit && (
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {formatNumber(dailyUsed)} / {formatNumber(user.dailyTokenLimit)}
            </span>
            <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(getPercentage(dailyUsed, user.dailyTokenLimit))}`}
                style={{ width: `${Math.min(getPercentage(dailyUsed, user.dailyTokenLimit), 100)}%` }}
              ></div>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">daily</span>
          </div>
        )}

        {/* Refresh Button */}
        <button
          onClick={fetchUsageInfo}
          className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
          title="Refresh usage"
        >
          <FiRefreshCw className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default CompactTokenUsage;