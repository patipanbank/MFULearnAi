import React, { useState, useEffect } from 'react';
import { FiX, FiBarChart, FiUsers, FiTrendingUp, FiActivity, FiRefreshCw } from 'react-icons/fi';
import { useUIStore } from '../stores';
import { api } from '../lib/api';

interface UserStats {
  total: number;
  byRole: {
    [key: string]: number;
  };
}

interface DepartmentStats {
  totalDepartments: number;
  activeDepartments: number;
  emptyDepartments: number;
  userStats: {
    totalUsers: number;
    averageUsersPerDepartment: number;
    maxUsersInDepartment: number;
    minUsersInDepartment: number;
  };
  topDepartments: Array<{
    _id?: string;
    name: string;
    displayName?: string;
    userCount: number;
  }>;
}

interface SystemAnalytics {
  userStats: UserStats;
  departmentStats: DepartmentStats;
  recentActivity: {
    recentUsers: Array<{
      _id: string;
      username: string;
      email: string;
      role: string;
      created: string;
    }>;
  };
}

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminAnalyticsModal: React.FC<AnalyticsModalProps> = ({ isOpen, onClose }) => {
  const { addToast } = useUIStore();
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'departments' | 'activity'>('overview');

  useEffect(() => {
    if (isOpen) {
      fetchAnalytics();
    }
  }, [isOpen]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [analyticsResponse, departmentResponse] = await Promise.all([
        api.get<SystemAnalytics>('/admin/analytics'),
        api.get<DepartmentStats>('/admin/departments/stats')
      ]);

      setAnalytics(analyticsResponse);
      setDepartmentStats(departmentResponse);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch analytics data'
      });
    } finally {
      setLoading(false);
    }
  };

  const roleColors = {
    SuperAdmin: 'bg-red-500',
    Admin: 'bg-orange-500',
    Staffs: 'bg-blue-500',
    Students: 'bg-green-500'
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: FiBarChart },
    { id: 'users', name: 'Users', icon: FiUsers },
    { id: 'departments', name: 'Departments', icon: FiUsers },
    { id: 'activity', name: 'Activity', icon: FiActivity }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <FiBarChart className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold text-primary">System Analytics</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="btn-ghost flex items-center space-x-2"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Sidebar */}
          <div className="w-48 border-r border-border bg-muted/30">
            <nav className="p-4 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-secondary hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-primary">System Overview</h3>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="card p-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <FiUsers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm text-secondary">Total Users</p>
                            <p className="text-xl font-bold text-primary">
                              {analytics?.userStats.total.toLocaleString() || '0'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="card p-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                            <FiUsers className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="text-sm text-secondary">Active Departments</p>
                            <p className="text-xl font-bold text-primary">
                              {departmentStats?.activeDepartments || '0'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="card p-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                            <FiTrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <p className="text-sm text-secondary">Avg Users/Dept</p>
                            <p className="text-xl font-bold text-primary">
                              {departmentStats?.userStats.averageUsersPerDepartment || '0'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="card p-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                            <FiActivity className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div>
                            <p className="text-sm text-secondary">Max Users in Dept</p>
                            <p className="text-xl font-bold text-primary">
                              {departmentStats?.userStats.maxUsersInDepartment || '0'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Insights */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* User Distribution */}
                      <div className="card p-6">
                        <h4 className="text-lg font-semibold text-primary mb-4">User Distribution by Role</h4>
                        <div className="space-y-3">
                          {analytics?.userStats.byRole && Object.entries(analytics.userStats.byRole).map(([role, count]) => (
                            <div key={role} className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={`w-3 h-3 rounded-full ${roleColors[role as keyof typeof roleColors] || 'bg-gray-500'}`} />
                                <span className="text-secondary">{role}</span>
                              </div>
                              <span className="font-medium text-primary">{count.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Department Health */}
                      <div className="card p-6">
                        <h4 className="text-lg font-semibold text-primary mb-4">Department Health</h4>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-secondary">Total Departments</span>
                            <span className="font-medium text-primary">{departmentStats?.totalDepartments || 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-secondary">Active Departments</span>
                            <span className="font-medium text-green-600">{departmentStats?.activeDepartments || 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-secondary">Empty Departments</span>
                            <span className="font-medium text-orange-600">{departmentStats?.emptyDepartments || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'users' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-primary">User Analytics</h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Role Distribution */}
                      <div className="card p-6">
                        <h4 className="text-lg font-semibold text-primary mb-4">Role Distribution</h4>
                        <div className="space-y-4">
                          {analytics?.userStats.byRole && Object.entries(analytics.userStats.byRole).map(([role, count]) => {
                            const percentage = analytics.userStats.total > 0 ? (count / analytics.userStats.total * 100) : 0;
                            return (
                              <div key={role}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-secondary">{role}</span>
                                  <span className="text-sm font-medium text-primary">
                                    {count.toLocaleString()} ({percentage.toFixed(1)}%)
                                  </span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${roleColors[role as keyof typeof roleColors] || 'bg-gray-500'}`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* User Statistics */}
                      <div className="card p-6">
                        <h4 className="text-lg font-semibold text-primary mb-4">User Statistics</h4>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-secondary">Total Users</span>
                            <span className="font-medium text-primary text-xl">
                              {analytics?.userStats.total.toLocaleString() || '0'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-secondary">Users with Departments</span>
                            <span className="font-medium text-primary">
                              {departmentStats?.userStats.totalUsers.toLocaleString() || '0'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-secondary">Users without Departments</span>
                            <span className="font-medium text-orange-600">
                              {((analytics?.userStats.total || 0) - (departmentStats?.userStats.totalUsers || 0)).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'departments' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-primary">Department Analytics</h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Top Departments */}
                      <div className="card p-6">
                        <h4 className="text-lg font-semibold text-primary mb-4">Top Departments by Users</h4>
                        <div className="space-y-3">
                          {departmentStats?.topDepartments.slice(0, 10).map((dept, index) => (
                            <div key={dept._id || dept.name} className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-medium text-primary">
                                  {index + 1}
                                </div>
                                <span className="text-secondary truncate">
                                  {dept.displayName || dept.name}
                                </span>
                              </div>
                              <span className="font-medium text-primary">{dept.userCount}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Department Distribution */}
                      <div className="card p-6">
                        <h4 className="text-lg font-semibold text-primary mb-4">Department Distribution</h4>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                              <p className="text-2xl font-bold text-green-600">
                                {departmentStats?.activeDepartments || 0}
                              </p>
                              <p className="text-sm text-secondary">Active</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-orange-600">
                                {departmentStats?.emptyDepartments || 0}
                              </p>
                              <p className="text-sm text-secondary">Empty</p>
                            </div>
                          </div>

                          <div className="space-y-3 pt-4 border-t border-border">
                            <div className="flex items-center justify-between">
                              <span className="text-secondary">Min Users/Dept</span>
                              <span className="font-medium text-primary">
                                {departmentStats?.userStats.minUsersInDepartment || 0}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-secondary">Max Users/Dept</span>
                              <span className="font-medium text-primary">
                                {departmentStats?.userStats.maxUsersInDepartment || 0}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-secondary">Average Users/Dept</span>
                              <span className="font-medium text-primary">
                                {departmentStats?.userStats.averageUsersPerDepartment || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-primary">Recent Activity</h3>

                    <div className="card p-6">
                      <h4 className="text-lg font-semibold text-primary mb-4">Recent User Registrations</h4>
                      <div className="space-y-3">
                        {analytics?.recentActivity.recentUsers.map((user) => (
                          <div key={user._id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <div>
                              <p className="font-medium text-primary">{user.username}</p>
                              <p className="text-sm text-secondary">{user.email}</p>
                            </div>
                            <div className="text-right">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                roleColors[user.role as keyof typeof roleColors] ?
                                'text-white' : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
                              }`} style={{
                                backgroundColor: roleColors[user.role as keyof typeof roleColors] || undefined
                              }}>
                                {user.role}
                              </span>
                              <p className="text-xs text-secondary mt-1">
                                {new Date(user.created).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsModal;