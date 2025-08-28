import React, { useState, useEffect } from 'react';
import { FiActivity, FiRefreshCw, FiAlertTriangle, FiDatabase, FiZap } from 'react-icons/fi';

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
    if (percentage >= 90) return 'bg-red-500 dark:bg-red-400';
    if (percentage >= 75) return 'bg-yellow-500 dark:bg-yellow-400';
    return 'bg-emerald-500 dark:bg-emerald-400';
  };

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 md:space-x-3 px-2 md:px-4 py-1.5 md:py-2 bg-secondary rounded-lg transition-colors duration-200 min-w-48 md:min-w-64 ${className}`}>
        <FiRefreshCw className="animate-spin h-3 w-3 md:h-4 md:w-4 text-muted" />
        <span className="text-xs md:text-sm text-muted">Loading usage...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center space-x-2 md:space-x-3 px-2 md:px-4 py-1.5 md:py-2 bg-secondary rounded-lg transition-colors duration-200 min-w-48 md:min-w-64 ${className}`}>
        <FiAlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-red-500 dark:text-red-400" />
        <span className="text-xs md:text-sm text-red-600 dark:text-red-400">Usage error</span>
      </div>
    );
  }

  if (!usageInfo) {
    return (
      <div className={`flex items-center space-x-2 md:space-x-3 px-2 md:px-4 py-1.5 md:py-2 bg-secondary rounded-lg transition-colors duration-200 min-w-48 md:min-w-64 ${className}`}>
        <FiDatabase className="h-3 w-3 md:h-4 md:w-4 text-muted" />
        <span className="text-xs md:text-sm text-muted">No usage data</span>
      </div>
    );
  }

  const { user, usage } = usageInfo;
  const today = new Date().toISOString().split('T')[0];
  const isToday = usage?.dailyUsage?.date === today;
  const dailyUsed = isToday ? (usage?.dailyUsage?.totalTokens || 0) : 0;

  return (
    <div className={`flex items-center space-x-2 md:space-x-3 px-2 md:px-4 py-1.5 md:py-2 bg-secondary hover:bg-accent rounded-lg transition-colors duration-200 min-w-48 md:min-w-64 ${className}`}>
      <FiZap className="h-3 w-3 md:h-4 md:w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
      
      <div className="flex-1 text-left min-w-0">
        {user?.dailyTokenLimit ? (
          <>
            <div className="text-xs md:text-sm font-medium text-primary truncate">
              {formatNumber(dailyUsed)} / {formatNumber(user.dailyTokenLimit)} tokens
            </div>
            <div className="flex items-center space-x-1 md:space-x-2 mt-0.5">
              <div className="flex-1 bg-background-secondary rounded-full h-1.5 md:h-2">
                <div
                  className={`h-1.5 md:h-2 rounded-full transition-all duration-300 ${getProgressBarColor(getPercentage(dailyUsed, user.dailyTokenLimit))}`}
                  style={{ width: `${Math.min(getPercentage(dailyUsed, user.dailyTokenLimit), 100)}%` }}
                ></div>
              </div>
              <span className="text-[10px] md:text-xs text-muted whitespace-nowrap">
                {getPercentage(dailyUsed, user.dailyTokenLimit)}% used
              </span>
            </div>
          </>
        ) : (
          <div className="text-xs md:text-sm text-muted">
            Token usage unavailable
          </div>
        )}
      </div>

      <button
        onClick={fetchUsageInfo}
        className="p-0.5 md:p-1 text-muted hover:text-secondary transition-colors duration-200 flex-shrink-0"
        title="Refresh usage"
      >
        <FiRefreshCw className="h-2.5 w-2.5 md:h-3 md:w-3" />
      </button>
    </div>
  );
};

export default CompactTokenUsage;