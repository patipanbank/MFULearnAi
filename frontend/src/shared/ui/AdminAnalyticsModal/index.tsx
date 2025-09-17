import React, { useState, useEffect } from 'react';
import { FiRefreshCw, FiUsers, FiDatabase, FiActivity, FiBarChart } from 'react-icons/fi';
import { useUIStore } from '../../stores';
import { api } from '../../lib/api';
import UniversalModal from '../UniversalModal';

interface AdminAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SystemAnalytics {
  userStats: {
    total: number;
    byRole: {
      [key: string]: number;
    };
  };
  collectionStats: {
    total: number;
    totalDocuments: number;
    collections: Array<{
      name: string;
      permission: string;
      createdBy: string;
      documentCount: number;
      department?: string;
    }>;
  };
  recentActivity: {
    recentUsers: Array<{
      _id: string;
      username: string;
      email: string;
      role: string;
      created: Date;
    }>;
  };
}

const AdminAnalyticsModal: React.FC<AdminAnalyticsModalProps> = ({ isOpen, onClose }) => {
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const { addToast } = useUIStore();

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const data = await api.get<SystemAnalytics>('/admin/analytics');
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load system analytics'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAnalytics();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SuperAdmin':
        return 'bg-red-500';
      case 'Admin':
        return 'bg-orange-500';
      case 'Staffs':
        return 'bg-blue-500';
      case 'Students':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getPermissionColor = (permission: string) => {
    switch (permission.toLowerCase()) {
      case 'public':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'private':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <UniversalModal
      isOpen={isOpen}
      onClose={onClose}
      modalType="analytics"
      title="System Analytics"
      subtitle="Overview of system usage and statistics"
      headerIcon={
        <button
          onClick={fetchAnalytics}
          className="btn-ghost p-2"
          disabled={loading}
        >
          <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-secondary">Loading analytics...</span>
            </div>
          ) : analytics ? (
            <div className="space-y-8">
              {/* Overview Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="card p-6">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-blue-500 rounded-lg flex items-center justify-center">
                      <FiUsers className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-secondary">Total Users</p>
                      <p className="text-2xl font-bold text-primary">{analytics.userStats.total}</p>
                    </div>
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-green-500 rounded-lg flex items-center justify-center">
                      <FiDatabase className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-secondary">Collections</p>
                      <p className="text-2xl font-bold text-primary">{analytics.collectionStats.total}</p>
                    </div>
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-purple-500 rounded-lg flex items-center justify-center">
                      <FiActivity className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-secondary">Documents</p>
                      <p className="text-2xl font-bold text-primary">{analytics.collectionStats.totalDocuments}</p>
                    </div>
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-orange-500 rounded-lg flex items-center justify-center">
                      <FiBarChart className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-secondary">Avg Docs/Collection</p>
                      <p className="text-2xl font-bold text-primary">
                        {analytics.collectionStats.total > 0
                          ? Math.round(analytics.collectionStats.totalDocuments / analytics.collectionStats.total)
                          : 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Distribution by Role */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="card p-6">
                  <h3 className="text-lg font-semibold text-primary mb-4">User Distribution by Role</h3>
                  <div className="space-y-3">
                    {Object.entries(analytics.userStats.byRole).map(([role, count]) => (
                      <div key={role} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`h-3 w-3 rounded-full ${getRoleColor(role)}`}></div>
                          <span className="text-sm font-medium text-primary">{role}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-secondary">{count} users</span>
                          <span className="text-xs text-muted">
                            ({analytics.userStats.total > 0 ? Math.round((count / analytics.userStats.total) * 100) : 0}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Users */}
                <div className="card p-6">
                  <h3 className="text-lg font-semibold text-primary mb-4">Recent Users</h3>
                  <div className="space-y-3">
                    {analytics.recentActivity.recentUsers.slice(0, 5).map((user) => (
                      <div key={user._id} className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-xs">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary truncate">{user.username}</p>
                          <p className="text-xs text-secondary truncate">{user.email}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            user.role === 'SuperAdmin'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : user.role === 'Admin'
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                              : user.role === 'Staffs'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                          }`}>
                            {user.role}
                          </span>
                          <p className="text-xs text-muted mt-1">
                            {new Date(user.created).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Collections Overview */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-primary mb-4">Collections Overview</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 font-medium text-primary">Collection Name</th>
                        <th className="text-left py-3 px-2 font-medium text-primary">Permission</th>
                        <th className="text-left py-3 px-2 font-medium text-primary">Created By</th>
                        <th className="text-left py-3 px-2 font-medium text-primary">Department</th>
                        <th className="text-right py-3 px-2 font-medium text-primary">Documents</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.collectionStats.collections.slice(0, 10).map((collection, index) => (
                        <tr key={index} className="border-b border-border hover:bg-secondary">
                          <td className="py-3 px-2 font-medium text-primary">{collection.name}</td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPermissionColor(collection.permission)}`}>
                              {collection.permission}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-secondary">{collection.createdBy}</td>
                          <td className="py-3 px-2 text-secondary">{collection.department || '-'}</td>
                          <td className="py-3 px-2 text-right text-primary font-medium">{collection.documentCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {analytics.collectionStats.collections.length > 10 && (
                    <div className="text-center py-3">
                      <p className="text-sm text-muted">
                        Showing 10 of {analytics.collectionStats.collections.length} collections
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <FiBarChart className="h-12 w-12 mx-auto text-muted opacity-50" />
              <p className="text-muted mt-2">No analytics data available</p>
            </div>
          )}
      </div>
    </UniversalModal>
  );
};

export default AdminAnalyticsModal;